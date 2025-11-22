# DEVLOG

## F1.devlog

### How we satisfied the software requirements

We are using TypeScript, which does not provide support for 3D rendering & physics. We are using Three.js as our third-party rendering library. We are using Ammo.js as our physics simulation library. Our playable prototype uses a simple physics-based puzzle. The player must open a door by dropping a block on a button. The player can only win by dropping the block on the button, but if they do not manage to do this in 3 attempts, they fail. The game detects the player's success or failure and gives a response using the game's graphics. We are using Deno for linting, autoformatting, and precommit typechecking and build tests. We are using GitHub Actions for post-push automation.

### Reflection

We decided to use TypeScript, Three.js, Ammo.js, Deno, GitHub Actions, GitHub Codespaces, Copilot, and ChatGPT for the reasons explained in the README. However, we experimented with Live Share and found serious issues with it when coding collaboratively. Whenever there were multiple collaborators on this project using Live Share, there would be issues from people's input, resulting in messed up code, unwanted indentations, and erroneous formatting, even if only one person was coding at a time. We switched to simply coordinating people working on the project and pulling and pushing from GitHub. We also use Discord streaming to keep track of what the primary collaborator is doing. We stuck to our roles but found it useful to work on each others' roles to a greater degree than what we had anticipated.
