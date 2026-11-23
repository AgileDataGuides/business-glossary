# A Deleted Glossary Now Stays Deleted in the Business Glossary App

**21 October 2026**

AgileDataGuides today released a fix to the Business Glossary app, so deleting a glossary that has unsaved changes removes it for good.

## The Problem

When a user changed a glossary and then deleted it before the next save, the glossary came back. The app deleted the file, then moved to the next glossary in the list. Moving on saves any unsaved changes first, and the changes still belonged to the glossary just deleted. So the app wrote it straight back to disk, and it reappeared in the switcher on the next reload.

## The Solution

Deleting a glossary now drops its unsaved changes before the delete is sent, so moving to the next glossary has nothing left to save. A save still waiting to run from the last edit is cancelled too. Unsaved changes to a different glossary are not affected.

## Key Benefits

- **Delete means delete**: a deleted glossary does not come back on reload
- **No clean-up loop**: no need to delete the same glossary twice
- **Same in six apps**: Metric Trees, Access, Business Glossary, Data Dictionary, Data Contract and the Information Product Canvas got the same fix

The fix is available now in the Business Glossary app in the Context Plane monorepo, and it reaches the public app at [github.com/AgileDataGuides/business-glossary](https://github.com/AgileDataGuides/business-glossary) on its next publish.
