---
'describe-me': minor
---

The viewer can hide its sidebar and its inspector. The first row of a test, an overview and Foundations starts with a toggle for the sidebar and ends with one for the inspector, and `[` and `]` do the same. Until you toggle a panel, the window's width decides: below 1100 px the inspector starts hidden, below 800 px the sidebar too. A toggled panel stays as you left it, kept per project in `localStorage` like the sidebar's width. `/` and a tag in the inspector show a hidden sidebar.

A test's path too long for its row gives up its `describe` blocks first, then ends the test's name in an ellipsis, and its title shows it whole.
