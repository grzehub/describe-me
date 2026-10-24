---
'describe-me': minor
---

The viewer's sidebar shows the groups of `sidebar.groups`. A group is a row with an arrow and its name, and a click on the row opens or closes it. The viewer keeps closed groups per project, as it keeps collapsed suites. Groups come in the order of the config, a group's subgroups before its files, and files without a group come last. ↑ ↓ skip closed groups, opening a test opens its groups, and the search also matches the names of a file's groups. A group without subgroups whose one file has a single `describe` of the group's name, in any case, shows as that file alone. A link without a test opens the first test of the sidebar. A manifest without groups shows the sidebar as before.
