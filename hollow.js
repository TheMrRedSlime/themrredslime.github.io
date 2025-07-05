// DOM Elements
const dialogueBox = document.getElementById("dialogueBox");
const textLineElement = document.getElementById("textLine");
const optionsContainer = document.getElementById("optionsContainer");
// characterArea DOM element removed
const objectiveBox = document.getElementById("objectiveBox");
const gameContainer = document.querySelector(".game-container");

// Message Box Elements
const messageBoxOverlay = document.getElementById("messageBoxOverlay");
const messageBoxText = document.getElementById("messageBoxText");
const messageBoxButton = document.getElementById("messageBoxButton");

messageBoxButton.addEventListener("click", () => {
    messageBoxOverlay.classList.remove("active");
});

function showMessage(message) {
    messageBoxText.textContent = message;
    messageBoxOverlay.classList.add("active");
}

// Game State
let currentScene = "intro";
let dialogueIndex = 0;
let typingTimeout;

// Character Definitions object removed

// --- Story Script ---
const script = {
    intro: [
        { speaker: "Narrator", text: "Hello." },
        { speaker: "Narrator", text: "I am the game." },
        { speaker: "Narrator", text: "Yes I talk." },
        { speaker: "Narrator", text: "Before you do anything. Some decisions you make..." },
        { speaker: "Narrator", text: "It may heavily change the storyline." },
        {
            speaker: "Narrator",
            text: "Would you like to play the game?",
            options: [
                { text: "YES", action: () => advanceScene("startGame") },
                { text: "NO", action: () => advanceScene("quitGame") }
            ]
        }
    ],
    startGame: [
        {
            speaker: "Narrator",
            text: "Excellent!",
            effect: "fadeOutIn",
            action: () => {
                gameContainer.style.backgroundColor = "#000";
                textLineElement.innerHTML = "";
                setTimeout(() => advanceScene("homeScene_WakeUp"), 1000);
            }
        }
    ],
    quitGame: [
        {
            speaker: "Narrator",
            text: "Understandable. The game will now close.",
            action: () => {
                showMessage("Game closed. Refresh to try again!");
                optionsContainer.innerHTML = "";
            }
        }
    ],
    homeScene_WakeUp: [
        // Removed setupScene call
        { speaker: "Mom", text: "Hey, sleepy head." },
        { speaker: "Nate", text: "..." },
        { speaker: "Mom", text: "Hey! Nate!" },
        { speaker: "Narrator", text: "Nate finally wakes up." },
        { speaker: "Nate", text: "**wakes up** **yawns** Whaaaaattt mom?" },
        { speaker: "Mom", text: "You got an exam tomorrow! Study!" },
        { speaker: "Nate", text: "Uhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh." },
        { speaker: "Mom", text: "I need you to make me money after all!" },
        {
            speaker: "Nate",
            text: "**sigh** Fine.",
            action: () => {
                showObjective("Go to your room");
                displayOptions([{ text: "Go to room", action: () => advanceScene("goToRoom") }]);
            }
        }
    ],
    goToRoom: [
        // Removed setupScene call
        { speaker: "Narrator", text: "Nate is in his room." },
        { speaker: "Nate", text: "Do I really have to study?" },
        { speaker: "Nate", text: "I need to get good marks..." },
        {
            speaker: "Nate",
            text: "I hate the indian education system.",
            action: () => {
                showObjective("TURN ON THE LAPTOP AND STUDY");
                displayOptions([{ text: "Use Laptop", action: () => advanceScene("useLaptop") }]);
            }
        }
    ],
    useLaptop: [
        { speaker: "Narrator", text: "Nate sits at the chair. The laptop turns on." },
        { speaker: "Nate", text: "**Pen Click** Here we go." },
        {
            action: () => {
                dialogueBox.classList.add("fade-out");
                textLineElement.innerHTML = "";
                setTimeout(() => {
                    textLineElement.innerHTML =
                        '<span class="narrator-text" style="text-align:center; font-size: 20px;">TWO HOURS LATER</span>';
                    dialogueBox.classList.remove("fade-out");
                    dialogueBox.classList.add("fade-in");
                    setTimeout(() => {
                        dialogueBox.classList.remove("fade-in");
                        textLineElement.innerHTML = "";
                        advanceScene("afterStudy");
                    }, 2500);
                }, 1000);
            }
        }
    ],
    afterStudy: [
        { speaker: "Nate", text: "Finally... Done." },
        { speaker: "Nate", text: "I need some slee-" },
        { speaker: "Narrator", text: "**Nate sleeps on the keyboard abruptly**" },
        {
            speaker: "Narrator",
            text: "Suddenly. Everything becomes darker.",
            effect: "fadeOut",
            action: () => {
                gameContainer.style.backgroundColor = "#000";
                // characterArea.innerHTML = ''; // Removed
                objectiveBox.style.display = "none";
                setTimeout(() => advanceScene("dreamSequenceStart"), 1500);
            }
        }
    ],
    dreamSequenceStart: [
        { speaker: "Narrator", text: "A blue light suddenly comes out of Nate's body.", effect: "fadeIn" },
        { speaker: "Narrator", text: "It goes down the floor..." },
        { speaker: "Narrator", text: "It goes down the earth's crust, and all layers..." },
        {
            speaker: "Narrator",
            text: "After some time going down, he reaches a place, seems a lot more green-ish.",
            action: () => {
                gameContainer.style.backgroundColor = "#0f290f";
                textLineElement.innerHTML = "";
                setTimeout(() => advanceScene("dreamArrival"), 1000);
            }
        }
    ],
    dreamArrival: [
        // Removed setupScene call
        {
            speaker: "Narrator",
            text: "The blue light soul thing's light fills the entire screen. Suddenly we see Nate sleeping... in the grass."
        },
        { speaker: "Nate", text: "**wakes up** **visibly confused** Wha-" },
        {
            speaker: "Nate",
            text: "**panic** Where the frick am I?!",
            action: () => {
                showObjective("Navigate");
                displayOptions([{ text: "Look around", action: () => advanceScene("dreamNavigate") }]);
            }
        }
    ],
    dreamNavigate: [
        { speaker: "Nate", text: "What the hell is that on the bottom?" },
        { speaker: "Narrator", text: "It seems Nate can sense the dialogue box. Which is not possible." },
        { speaker: "Nate", text: "Who was that?" },
        { speaker: "Narrator", text: "It also seems that Nate can hear me. One second." },
        {
            speaker: "Nate",
            text: "Huh?-",
            effect: "glitch",
            action: () => {
                textLineElement.classList.add("glitch");
                setTimeout(() => {
                    textLineElement.classList.remove("glitch");
                    advanceScene("NarratorFix");
                }, 1500);
            }
        }
    ],
    NarratorFix: [
        { speaker: "Narrator", text: "Here we go. Now I think it's fixed." },
        { speaker: "Nate", text: "What the hell is that on the top?" },
        { speaker: "Narrator", text: "Interesting." },
        {
            speaker: "Nate",
            text: "Navigate?. Might as well do that.",
            action: () => {
                displayOptions([{ text: "Walk East", action: () => advanceScene("walkEastToDiscordTown") }]);
            }
        }
    ],
    walkEastToDiscordTown: [
        { speaker: "Narrator", text: 'After some time walking East, he finds a sign named "Discord Town".' },
        { speaker: "Nate", text: "Discord?" },
        {
            speaker: "Narrator",
            text: "Nate goes inside the town.",
            action: () => {
                displayOptions([{ text: "Explore Discord Town", action: () => advanceScene("enterWarzoneBuilding") }]);
            }
        }
    ],
    enterWarzoneBuilding: [
        { speaker: "Narrator", text: "He walks for some time until he sees a building." },
        { speaker: "Nate", text: "Warzone? It can't be." },
        /*                { speaker: "Narrator", text: "Nate enters the building.", action: () => {
             showMessage("To be continued in Warzone Building...");
             displayOptions([{ text: "Restart Intro", action: () => { currentScene = 'intro'; dialogueIndex = 0; objectiveBox.style.display = 'none'; loadDialogue(); }}]);
        }} */
        { speaker: "Narrator", text: "Nate enters the building." },
        { speaker: "Narrator", text: "Inside the building, there seems to be couple of people." },
        { speaker: "Narrator", text: "Vallrak, Redslime, boruto" },
        { speaker: "Nate", text: "Wait, i remember thi-" },
        { speaker: "System", text: "To be Continued, Hopefully." }
    ],
    inWarzoneBuilding: []
};

// --- Game Logic Functions ---

function typeWriter(text, element, onComplete) {
    clearTimeout(typingTimeout);
    let i = 0;
    const speed = 30;
    element.innerHTML = "";

    function type() {
        if (i < text.length) {
            let substr = text.substring(i);
            if (substr.startsWith("<strong>")) {
                element.innerHTML += "<strong>";
                i += "<strong>".length;
            } else if (substr.startsWith("</strong>")) {
                element.innerHTML += "</strong>";
                i += "</strong>".length;
            } else if (substr.startsWith('<span class="speaker">')) {
                const tag = '<span class="speaker">';
                element.innerHTML += tag;
                i += tag.length;
            } else if (substr.startsWith("</span>")) {
                element.innerHTML += "</span>";
                i += "</span>".length;
            } else if (text.substring(i, i + 2) === "**") {
                if (element.innerHTML.endsWith("<strong>")) {
                    element.innerHTML = element.innerHTML.slice(0, -8) + "</strong>";
                } else {
                    element.innerHTML += "<strong>";
                }
                i += 2;
            } else {
                element.innerHTML += text.charAt(i);
                i++;
            }
            typingTimeout = setTimeout(type, speed);
        } else {
            if (element.innerHTML.includes("<strong>") && !element.innerHTML.endsWith("</strong>")) {
                element.innerHTML += "</strong>";
            }
            if (onComplete) {
                onComplete();
            }
        }
    }
    type();
}

function displayDialogue(line) {
    textLineElement.className = "";
    // optionsContainer.innerHTML = ''; // Moved: options are cleared by loadDialogue or when new options are set.

    let textForTypewriter = "";
    if (line.speaker === "Narrator") {
        textLineElement.classList.add("narrator-text");
        textForTypewriter = line.text;
    } else if (line.speaker && line.speaker !== "System") {
        textForTypewriter = `<span class="speaker">${line.speaker}:</span> ${line.text}`;
    } else {
        textForTypewriter = line.text;
    }

    typeWriter(textForTypewriter, textLineElement, () => {
        // This is the onComplete callback for typeWriter
        // Check if a "Next >" button is needed
        // It's needed if:
        // 1. The current line object itself doesn't define `options`.
        // 2. The `optionsContainer` is currently empty (meaning an inline `action` didn't already populate it).
        // 3. It's not the last line of the current scene.
        if (
            !line.options &&
            optionsContainer.innerHTML.trim() === "" &&
            dialogueIndex < script[currentScene].length - 1
        ) {
            displayOptions([
                {
                    text: "Next >",
                    action: () => {
                        dialogueIndex++;
                        loadDialogue();
                    }
                }
            ]);
        }
    });

    // If options are directly defined on the line object, display them.
    // This is separate from options potentially added by an inline `action`.
    if (line.options) {
        displayOptions(line.options);
    }
}

function displayOptions(options) {
    optionsContainer.innerHTML = ""; // Clear any existing options (like a previous "Next >")
    options.forEach((option) => {
        const button = document.createElement("button");
        button.textContent = option.text;
        button.onclick = () => {
            if (typeof option.action === "function") {
                option.action();
            }
        };
        optionsContainer.appendChild(button);
    });
}

function advanceScene(nextScene) {
    console.log(`Advancing from ${currentScene}[${dialogueIndex}] to ${nextScene}`);
    currentScene = nextScene;
    dialogueIndex = 0;
    objectiveBox.style.display = "none";
    optionsContainer.innerHTML = ""; // Clear options when advancing to a new scene

    const firstLineOfNewScene = script[currentScene] && script[currentScene][0];
    if (firstLineOfNewScene && firstLineOfNewScene.effect) {
        handleEffect(firstLineOfNewScene.effect, () => loadDialogue());
    } else {
        loadDialogue();
    }
}

function handleEffect(effectName, callback) {
    dialogueBox.classList.remove("fade-in", "fade-out");
    gameContainer.classList.remove("fade-in", "fade-out");
    // characterArea references removed

    switch (effectName) {
        case "fadeOutIn":
            dialogueBox.classList.add("fade-out");
            gameContainer.classList.add("fade-out");
            setTimeout(() => {
                textLineElement.innerHTML = "";
                dialogueBox.classList.remove("fade-out");
                dialogueBox.classList.add("fade-in");
                gameContainer.classList.remove("fade-out");
                gameContainer.classList.add("fade-in");
                if (callback) setTimeout(callback, 500);
            }, 1000);
            break;
        case "fadeOut":
            dialogueBox.classList.add("fade-out");
            setTimeout(() => {
                textLineElement.innerHTML = "";
                if (callback) callback();
            }, 1000);
            break;
        case "fadeIn":
            dialogueBox.style.opacity = "0";
            gameContainer.style.opacity = "0";
            dialogueBox.classList.add("fade-in");
            gameContainer.classList.add("fade-in");
            setTimeout(() => {
                dialogueBox.style.opacity = "";
                gameContainer.style.opacity = "";
                if (callback) callback();
            }, 10);
            break;
        case "glitch":
            if (callback) callback();
            break;
        default:
            if (callback) callback();
            break;
    }
}

// setupScene function removed

function showObjective(text) {
    objectiveBox.textContent = `OBJECTIVE: ${text}`;
    objectiveBox.style.display = "block";
}

function loadDialogue() {
    clearTimeout(typingTimeout);
    optionsContainer.innerHTML = ""; // Clear options before loading new line/processing actions

    if (!script[currentScene] || !script[currentScene][dialogueIndex]) {
        console.error(`Scene or dialogue index out of bounds: ${currentScene}[${dialogueIndex}]`);
        textLineElement.innerHTML = "<p>[End of current script path or error]</p>";
        displayOptions([
            {
                text: "Restart Intro",
                action: () => {
                    currentScene = "intro";
                    dialogueIndex = 0;
                    objectiveBox.style.display = "none";
                    loadDialogue();
                }
            }
        ]);
        return;
    }

    const line = script[currentScene][dialogueIndex];

    // Case 1: Action-only line (no text, no options defined in *this* line object)
    if (line.action && !line.text && !line.options) {
        const sceneBeforeAction = currentScene;
        const indexBeforeAction = dialogueIndex;
        if (typeof line.action === "function") {
            line.action();
        }
        if (currentScene === sceneBeforeAction && dialogueIndex === indexBeforeAction) {
            if (dialogueIndex < script[currentScene].length - 1) {
                dialogueIndex++;
                loadDialogue();
            } else {
                console.log("Action-only line executed, end of scene or waiting.");
            }
        }
        return;
    }

    // Case 2: Line with text, and possibly an action and/or options.
    // Execute inline action if present (this action might call displayOptions)
    if (line.action && (line.text || line.options)) {
        // line.options here refers to options property on the line object itself
        if (typeof line.action === "function") {
            line.action(); // This is where `displayOptions` for "Go to room" is called
        }
    }
    // Display the dialogue text. The onComplete callback of typeWriter will handle
    // adding a "Next >" button IF no options were defined on the line object itself
    // AND if the optionsContainer wasn't populated by an inline action.
    displayDialogue(line);
}

window.onload = () => {
    if (script[currentScene] && script[currentScene][dialogueIndex]) {
        const firstLine = script[currentScene][dialogueIndex];
        if (firstLine.effect) {
            handleEffect(firstLine.effect, () => loadDialogue());
        } else {
            loadDialogue();
        }
    } else {
        textLineElement.innerHTML = "<p>Error: Initial game script not found.</p>";
        console.error("Initial script not found for scene:", currentScene);
    }
};
