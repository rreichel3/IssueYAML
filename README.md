# IssueYAML
An action to automatically create and bump issues.

If the action sees a scheduled event or manual trigger it will run the bump logic. If it is triggered any other way, it will attempt to create any missing issues. 

Note, this is a beta release. Its not very flexible.  PR's welcome 😁.

## Issue Creation Action
```yaml
on:
  push:
    branches:
      - main
    paths:
      - 'issues'

jobs:
  create_issues:
    runs-on: ubuntu-latest
    name: Create issue on merge to main
    steps:
      # To use this repository's private action,
      # you must check out the repository
      - name: Checkout
        uses: actions/checkout@v2
      - name: Create issues
        uses: rreichel3/IssueYAML@v1
```

## Issue Bump Action
```yaml
on:
  schedule:
    # * is a special character in YAML so you have to quote this string
    - cron:  '50 * * * *'

jobs:
  create_issues:
    runs-on: ubuntu-latest
    name: Ping issues
    steps:
      # To use this repository's private action,
      # you must check out the repository
      - name: Checkout
        uses: actions/checkout@v2
      - name: Ping issues
        uses: rreichel3/IssueYAML@v1
```
