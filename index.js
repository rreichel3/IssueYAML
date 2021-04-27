const core = require('@actions/core');
const github = require('@actions/github');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml')
const simpleGit = require('simple-git');


// We're going to run this weekly so we only want 6 days of inactivity so our activity doesn't count for ourselves
var ONE_WEEK = 7 * 24 * 60 * 60 * 1000;

var BUMP_COMMENT = "👋 Hey there! This is a friendly bump on this issue as its been over a week since there's been any updates to it.";

function walkDir(dir) {
  var files = []
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ?
      files = files.concat(walkDir(dirPath)) : files.push(path.join(dir, f));
  });
  return files;
}

async function createIssue(issueObj, octokitClient) {
  console.log(issueObj)
  const owner = issueObj.nwo.split('/')[0]
  const repo = issueObj.nwo.split('/')[1]
  console.log("Making create issue call.")
  const creationResponse = await octokitClient.request(`POST /repos/${owner}/${repo}/issues`, {
    title: issueObj.title,
    body: issueObj.body,
    labels: issueObj.labels,
  });
  console.log("Successfully created issue.")
  console.log(creationResponse);
  return creationResponse
}
async function getIssue(issueObj, octokit) {
  const owner = issueObj.nwo.split('/')[0]
  const repo = issueObj.nwo.split('/')[1]
  const issueNumber = issueObj.number;
  const issueResponse = await octokit.request(`GET /repos/${owner}/${repo}/issues/${issueNumber}`, {})
  console.log(issueResponse);
  return issueResponse;
}
async function bumpIssue(issueObj, octokit) {
  const owner = issueObj.nwo.split('/')[0]
  const repo = issueObj.nwo.split('/')[1]
  const issueNumber = issueObj.number;
  await octokit.request(`POST /repos/${owner}/${repo}/issues/${issueNumber}/comments`, {
    body: BUMP_COMMENT,
  })
}
async function main() {
  try {

    const token = core.getInput('github-token');
    const pathToYaml = core.getInput('path-to-yaml-issues');
    console.log(`PARAM: (pathToYaml, ${pathToYaml}`);

    //TODO: Check if this was triggered by a push by Actions bot (if so ignore)
    const octokit = github.getOctokit(token);

    // Get all files in the directory
    const files = walkDir(pathToYaml);
    // We only want YAML files
    const yamlFiles = files.filter(file => file.endsWith('.yaml') || file.endsWith('.yml'));

    const issueFiles = yamlFiles.map(file => {
      const fileText = fs.readFileSync(file, 'utf8');
      const issueObj = yaml.load(fileText);
      if (issueObj == null) {
        return null;
      }
      issueObj.path = file;
      return issueObj;
    }).filter(issueFile => issueFile != null);
    var needsCommit = false;
    console.log("Instantiating simpleGit");

    const git = simpleGit(pathToYaml);
    git.addConfig("user.email", "issueyaml@github.com");
    git.addConfig("user.name", "Issue YAML");
    for (const issueObj of issueFiles) {
      console.log(`Processing file: ${issueObj.path}`)
      var updatedIssueList = [];
      if ('issues' in issueObj) {
        for (const issue of issueObj.issues) {
          console.log(issue);
          if ('number' in issue) {
            console.log(issue.id);
            // We don't need to create the issue, its been created already
            //TODO: Check if we were triggered by manual or scheduled action, if so bump the issue
            console.log(github.context);
            const triggerEvent = github.context.eventName;
            console.log("Trigger Event: " + triggerEvent);
            if (triggerEvent === "schedule" || triggerEvent === "workflow_dispatch") {
              const issueResponse = await getIssue(issue, octokit);
              const i = issueResponse.data;
              if (i.state === "closed") {
                console.log(`Issue ${issue.title} has been closed`);
                continue;
              }
              const lastUpdate = new Date(i.updated_at);
              const now = new Date();
              if (now - lastUpdate > ONE_WEEK) {
                // We need to bump the issue
                console.log("We should bump the issue.")
                bumpIssue(issue, octokit);
              } else {
                console.log(`Issue ${issue.title} not bumped`);
              }
            }
            updatedIssueList.push(issue)
          } else {
            console.log("Attempting to create new issue.")
            needsCommit = true;
            const creationResponse = await createIssue(issue, octokit);
            if (creationResponse.status != 201) {
              console.log(creationResponse);
            } else {
              console.log(`Created issue ${issue.title}`);
              issue.number = creationResponse.data.number;
              issue.url = creationResponse.data.html_url;
              issue.created_at = creationResponse.data.created_at;
              updatedIssueList.push(issue);
            }
          }
        }
      }
      issueObj.issues = updatedIssueList;
      const path = issueObj.path;
      delete issueObj.path;
      fs.writeFileSync(path, yaml.dump(issueObj));
      await git.add(path);
    }
    if (needsCommit) {
      try {
        console.log("Attempting to commit");
        await git.commit("Auto commit from issue generation");

        console.log("Attempting to push");
        await git.push();
      }
      catch (e) { console.log(e); core.setFailed(e.message); }
    }

  } catch (error) {
    console.log(error);
    core.setFailed(error.message);
  }
}


main()
