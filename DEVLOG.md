# DEVLOG

## F1.devlog

### F1.How we satisfied the software requirements

We are using TypeScript, which does not provide support for 3D rendering & physics. We are using Three.js as our third-party rendering library. We are using Ammo.js as our physics simulation library. Our playable prototype uses a simple physics-based puzzle. The player must open a door by dropping a block on a button. The player can only win by dropping the block on the button, but if they do not manage to do this in 3 attempts, they fail. The game detects the player's success or failure and gives a response using the game's graphics. We are using Deno for linting, autoformatting, and precommit typechecking and build tests. We are using GitHub Actions for post-push automation.

### F1.Reflection

We decided to use TypeScript, Three.js, Ammo.js, Deno, GitHub Actions, GitHub Codespaces, Copilot, and ChatGPT for the reasons explained in the README. However, we experimented with Live Share and found serious issues with it when coding collaboratively. Whenever there were multiple collaborators on this project using Live Share, there would be issues from people's input, resulting in messed up code, unwanted indentations, and erroneous formatting, even if only one person was coding at a time. We switched to simply coordinating people working on the project and pulling and pushing from GitHub. We also use Discord streaming to keep track of what the primary collaborator is doing. We stuck to our roles but found it useful to work on each others' roles to a greater degree than what we had anticipated.

## F2.devlog

### F2.How we satisfied the software requirements

We are still using the same 3D rendering and physics simulation as we did in F1 which is 3JS and AmmoJS. The player can now move between rooms by opening a door with a key and moving through it. In the new room that they enter the player can pick up an item, which we made a bat. It does nothing at the moment, but they do carry it. The item picked up is put into an inventory that carries the key and the bat. The puzzle we have is almost the same as what we already had: a button on the ground needs to be activated by placing a block on it. That is how the key is acquired to open the door. The player can actually fail if they dont accurately place the block on the button within three attempts. Finally, grabbing the bat triggers the conclusion of the game which is just a sort of victory screen.

### F2.Reflection

Our original game didn't really have any controls for player movement. It was completely stationary and only allowed them to move the mouse. In order to satisfy the F2 requirements we had to remove the stationary camera completely and implement a camera than can be controlled with keys. Changing the viewing angle is controlled by holding right click and moving the mouse. This is something that should probably be changed in the future. Now that we have an extra scene, we also have to remove the failure condition after the door is open. If it were still active, that meant that after opening the door the player can still fail if they misclick.

## F3.Devlog

### F3.How we satisfied the software requirements

For our first chosen requirement we implemented continuous inventory. For this we used our already existing bat item and multiplied them by 3. After collecting all three bats, they appear stacked in the inventory and the player can break the boards with them. Our second requirement we chose was the save system. For this one, we added some buttons to the top left of the screen that have a save, load, and new game functions that allow the player to leave and comeback to their game later. Our third requirement was the visual themes requirement. Using the browser settings, the player can change the lighting of the game. Having dark mode disbables the lights in the environment and light mode turns them on. Our last chosen requirement was touchscreen functionality. We simply added some on-screen tumbpads that allow touchscreen functionality. There is no button you need to switch between controls, you can just switch by using them.

### F3.Reflection

The main thing we changed was our functionality with our bat item and the chest that the bat spawns from. Because we implemented the continuous inventory function, we simply spawned three bats next to each other, completely removing the need for the chest. We still have the chest there, but it does nothing. We decided that we will still be using the chest in future scenes. We would probably spawn an item in the chest that is not immediately useable in the current scene, but to be used in another one. We also originally was thinking of just adding the other functionality to the current scene we have, but that would mean that we would have to reimplement these features in new scenes. We instead opted to make different files that hold this functionality so that other scenes can use them.
