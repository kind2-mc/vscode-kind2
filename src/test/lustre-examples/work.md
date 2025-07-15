
### 6-26-25
## Conflicting Set in Tree View

- Removed obnoxious highlighting
- Hover functionality still present



## IVC Functionality (Partial)

- Shows one IVC and identifies all elements as part of the **must set** (for now) 
- UI functionality for showing **may set** is implemented but the backend is not implemented yet
- **Questions:**
  - What is an example of a function/node with multiple IVCs?  
    - None of my examples (e.g., `abs.lus`, `traffic2.lus`) seem to have multiple.
    - Maybe I was not using the options correctly from the command line (`ivc`, `ivc_all`, `ivc_must_set`, `print_ivc`)
- The `col` parameter that Kind2 gives is the RHS of the equals sign for standard variable assignments.  
  _It looks a little odd and should probably span the whole equation._
  - This could be a barrier that must be overcome by the extension.
  - I assume changing the way Kind2 outputs the start col of the IVCs is not an option because it would break existing functionality.
- Should have more robust hover information (that also looks nicer)



## Potential "Quick Settings" Menu Concepts

- ~~**Dropdown**~~
  - An extension cannot add another dropdown menu (File, Edit, ...)
- **TreeView**
  - I have implemented a conceptual version (buggy, but the visual elements are there)
  - Pros
     - Intuitive, easy, fast
     - Always on the screen when looking at the Kind2 output
  - Cons
    - On the same panel as Kind2 output
    - Making 2nd TreeView seems over the top
    - Numerical settings could be less intuitive (Potentially have to pop up a dialog box for them) needs more looking-into
  - Parts of this I like and parts of it are quite challenging from a design perspective
- **Webview Panel**
  - Pros
    - This would allow us to have full control over the UI 
    - Checkboxes, number inputs, etc. all easily doable

  - Cons 
    - Could feel out of place if not styled well
    - User would have 3 windows open at the same time (not a big deal)
    - Not as easy to access as TreeView
  - Don't have an implementation of this yet

  
---
### 7-3-25

## **Multiple IVC Support (fully implemented)**
  - Added backend functionality to accept multiple IVCs from the ivc_all option
  - Added menu in the TreeView that allows one to select which IVC to display in the editor
    - Consequently, moved both this IVC list and the old property list to new containers (folders) under the analysis
## **Settings Menu Overhaul**
  - Redid backend code for settings menu to allow for much easier addition of new settings 
    - The protocol for implementing the settings has changed from the original extension, I will write documentation for others who touch this project, but I feel it it quite intuitive
    - Want to add more options for customization of settings (Hover-for-description text, custom icon support, etc.)
  - Implemented new setting formats: toggle, number, single enum selector, multiple enum selector 
    - Fully implemented several important merit assignment settings using these formats
      - NOTE: UCT is not implemented on the server side, changing it has no effect on kind2 currently (easily doable)
    - Behavior of formats is fully defined by the existing code, just need to define the options themselves, their respective workspace properties (variables), and then implement them on the LS side 
## **Blame assignment (Half-implemented)**
  - Added fully functional Blame assignment options
    - MCS enabler
    - MCS all
    - MCS categories
  - Language server correctly identifies and stores all MCSs computed
    - *ISSUE*: The pre-existing LS code cannot handle when MCS is enabled
      - This is because it seems turning on MCS disables check's usual analysis (including IVC I believe) and only computes blame assignment, the current code assumes that the usual analysis is there
      - Potential fixes?
        - Make the check request make two Kind 2 calls when MCS is enabled in VS code
        - Go ahead and make it so that, in the VS Code extension, when check is called with MCS enabled, it ignores all other computations (this one doesn't seem intuitive to me)
## **Theme colors**
  - There is not many background-highlighting theme colors (with low alpha) that are greens, yellows, oranges, or reds
    - Found some candidates but I need to do more searching
    - Can see candidates in TreeNode.ts
    - Potentially, we could make it so that only one IVC/MCS can be highlighted at a time, so no need for colors (could use a more typical editor highlighting, should be plentiful in the ThemColors)
