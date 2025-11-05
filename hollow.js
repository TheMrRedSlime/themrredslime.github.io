/* This is the code of reality. what shapes the universe as a whole */

// DOM Elements
const dialogueBox = document.getElementById("dialogueBox");
const textLineElement = document.getElementById("textLine");
const optionsContainer = document.getElementById("optionsContainer");
const objectiveBox = document.getElementById("objectiveBox");
const gameContainer = document.querySelector(".game-container");

// Message Box Elements
const messageBoxOverlay = document.getElementById("messageBoxOverlay");
const messageBoxText = document.getElementById("messageBoxText");
const messageBoxButton = document.getElementById("messageBoxButton");

// Sounds
const beepSound = new Audio("beep.mp3");
beepSound.volume = 0.45;
const checkmate = new Audio("chess.mp3");
checkmate.volume = 0.03;
checkmate.loop = true;
checkmate.play();

messageBoxButton.addEventListener("click", () => {
  messageBoxOverlay.classList.remove("active");
});

function showMessage(message) {
  messageBoxText.textContent = message;
  messageBoxOverlay.classList.add("active");
}

function showActionMessage(message) {
  const actionBox = document.getElementById("actionMessageBox");
  if (actionBox) {
    actionBox.textContent = message;
    actionBox.style.borderColor = "#00ff00";
    actionBox.style.color = "#00ff00";

    // Brief flash effect
    actionBox.style.transform = "scale(1.05)";
    setTimeout(() => {
      actionBox.style.transform = "scale(1)";
    }, 200);
  }
}

// Game State
let currentScene = "intro";
let dialogueIndex = 0;
let typingTimeout;
let mana = 0;

// Fight System State
let inFight = false;
let currentFightEnemies = [];
let currentFightAllies = [];
let items = [];
let selectedAction = null;
let selectedItem = null;
let selectedTarget = null;
let currentFightVictoryScene = null;
let currentDefeatScene = null;

// Character Definitions
const characters = {
  Nate: { color: "#00ffff", health: 100, damage: 15, isPlayer: true },
  Mom: { color: "#ff00fe", health: 120, damage: 10, isPlayer: false },
  Vallrak: { color: "#1500ff", health: 1000, damage: 20, isPlayer: true },
  AmK: { color: "#640000", health: 1000, damage: 20, isPlayer: true },
  Redslime: {
    color: "#ff0000",
    health: 90,
    damage: 18,
    isPlayer: true,
    act: { damage: { amount: "25-75", mana: 34 } },
  },
  Boruto: {
    color: "#ffff00",
    health: 70,
    damage: 25,
    isPlayer: true,
    act: { heal: { amount: "25-75", mana: 25 } },
  },
  Goblin: { color: "#00ff00", health: 75, damage: 5, isPlayer: false },
  Slime: { color: "#1abc9c", health: 50, damage: 5, isPlayer: false },
  Dummy: { color: "#a74e00", health: 100, damage: 0, isPlayer: false },
  Creator: {
    color: "#000000",
    health: Infinity,
    damage: 6143,
    isPlayer: false,
  },
  Darkened: { color: "#640000", health: 100, damage: 0, isPlayer: false },
};

// --- Story Script ---
const script = {
  intro: [
    {
      speaker: "WARNING",
      text: "This game may include YOUR personal memories, nightmares, or traumatic events from your past. Proceed?",
      typingSpeed: 75,
      options: [
        {
          text: "YES",
          action: () => {
            dialogueIndex++;
            localStorage.setItem("scene", currentScene);
            localStorage.setItem("dialogueIndex", dialogueIndex);

            loadDialogue();
          },
        },
      ],
    },
    {
      speaker: "Narrator",
      text: "Hello.",
      action: () => {
        document.body.style.backgroundColor = "#242424";
      },
    },
    { speaker: "Narrator", text: "I am the narrator." },
    {
      speaker: "Narrator",
      text: "Before you do anything. Some decisions you make...",
    },
    { speaker: "Narrator", text: "It may heavily change the story." },
    { speaker: "Narrator", text: "And how you progress towards the game." },
    {
      speaker: "Narrator",
      text: "Would you like to play the game?",
      options: [
        { text: "YES", action: () => advanceScene("startGame") },
        { text: "NO", action: () => advanceScene("quitGame") },
      ],
    },
  ],
  test: [
    {
      speaker: "Narrator",
      text: "Suddenly, enemies appear!",
      action: () => startFight(["Vallrak"], ["Goblin", "Slime"], "startGame"),
    },
  ],
  startGame: [
    {
      speaker: "Narrator",
      text: "Excellent!",
      effect: "fadeOutIn",
      action: () => {
        gameContainer.style.backgroundColor = "#000";
        document.body.style.backgroundColor = "#000";
        textLineElement.innerHTML = "";
        setTimeout(() => advanceScene("homeScene_WakeUp"), 1000);
      },
    },
  ],
  quitGame: [
    {
      speaker: "Mom",
      text: "How could you leave us?",
      typingSpeed: 1,
      skip: true,
    },
    {
      speaker: "Mom",
      text: "How could you leave him?",
      typingSpeed: 1,
      skip: true,
    },
    {
      speaker: "Mom",
      text: "You left us alone, Took everything.",
      typingSpeed: 1,
      skip: true,
    },
    {
      speaker: "Mom",
      text: "With nothing to spare.",
      typingSpeed: 1,
      skip: true,
    },
    {
      speaker: "Narrator",
      text: "Understandable. The game will now close.",
      action: () => {
        showMessage("Game closed. Refresh to try again!");
        optionsContainer.innerHTML = "";
        localStorage.removeItem("scene");
      },
    },
  ],
  homeScene_WakeUp: [
    { speaker: "Mom", text: "Hey, sleepy head." },
    { speaker: "Nate", text: "..." },
    { speaker: "Mom", text: "Hey! Nate!" },
    { speaker: "Narrator", text: "Nate finally wakes up." },
    { speaker: "Nate", text: "*wakes up* *yawns* Whaaaaattt mom?" },
    { speaker: "Mom", text: "You got an exam tomorrow! Study!" },
    { speaker: "Nate", text: "Uhhhhhhhhhhhhhhhhhhhhhhhhhhhhh." },
    { speaker: "Mom", text: "I need you to make me money after all!" },
    {
      speaker: "Nate",
      text: "Fine.",
      action: () => {
        showObjective("Go to your room");
        displayOptions([
          { text: "Go to room", action: () => advanceScene("goToRoom") },
        ]);
      },
    },
  ],
  goToRoom: [
    { speaker: "Narrator", text: "Nate is in his room." },
    { speaker: "Nate", text: "Do I really have to study?" },
    { speaker: "Nate", text: "I need to get good marks..." },
    {
      speaker: "Nate",
      text: "I hate the education system.",
      action: () => {
        showObjective("TURN ON THE LAPTOP AND STUDY");
        displayOptions([
          { text: "Use Laptop", action: () => advanceScene("useLaptop") },
        ]);
      },
    },
  ],
  useLaptop: [
    {
      speaker: "Narrator",
      text: "Nate sits at the chair. The laptop turns on.",
    },
    { speaker: "Nate", text: "sigh. Here we go." },
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
      },
    },
  ],
  afterStudy: [
    { speaker: "Nate", text: "Finally... Done." },
    { speaker: "Nate", text: "I need some slee-" },
    { speaker: "Narrator", text: "*Nate sleeps on the keyboard abruptly*" },
    {
      speaker: "Narrator",
      text: "Suddenly. Everything becomes darker.",
      effect: "fadeOut",
      action: () => {
        gameContainer.style.backgroundColor = "#000";
        objectiveBox.style.display = "none";
        setTimeout(() => advanceScene("dreamSequenceStart"), 1500);
      },
    },
  ],
  dreamSequenceStart: [
    {
      speaker: "Narrator",
      text: "A blue light suddenly comes out of Nate's body.",
      effect: "fadeIn",
    },
    { speaker: "Narrator", text: "It goes down the floor..." },
    {
      speaker: "Narrator",
      text: "After some time going down, he reaches a place, seems a lot more green-ish.",
      action: () => {
        gameContainer.style.backgroundColor = "#0f290f";
        textLineElement.innerHTML = "";
        setTimeout(() => advanceScene("dreamArrival"), 5000);
      },
    },
  ],
  dreamArrival: [
    {
      speaker: "Narrator",
      text: "The blue lighted soul's light fills the entire screen. Suddenly we see Nate sleeping... in the grass.",
    },
    { speaker: "Nate", text: "Woah Wha-" },
    {
      speaker: "Nate",
      text: " Where the frick am I?!",
      action: () => {
        showObjective("Navigate");
        displayOptions([
          { text: "Look around", action: () => advanceScene("dreamNavigate") },
        ]);
      },
    },
  ],
  dreamNavigate: [
    { speaker: "Nate", text: "What the hell is that?" },
    {
      speaker: "Narrator",
      text: "It seems Nate can sense the dialogue box. Which is not possible.",
    },
    { speaker: "Nate", text: "Who was that?" },
    { speaker: "Narrator", text: "It also seems that Nate can hear me." },
    { speaker: "Nate", text: "Huh?-" },
    {
      speaker: "System",
      text: "[PLEASE WAIT CHANGES IN PROGRESS]",
      effect: "crt",
      action: () => advanceScene("NarratorFix"),
    },
  ],
  NarratorFix: [
    { speaker: "Narrator", text: "Here we go. Now I think it's fixed." },
    { speaker: "Nate", text: "What the hell is that?" },
    { speaker: "Narrator", text: "Interesting." },
    {
      speaker: "Nate",
      text: "Navigate?. Might as well do that.",
      action: () => {
        showObjective("NAVIGATE");
        displayOptions([
          {
            text: "Walk East",
            action: () => advanceScene("walkEastToDiscordTown"),
          },
        ]);
      },
    },
  ],
  walkEastToDiscordTown: [
    {
      speaker: "Narrator",
      text: 'After some time walking East, he finds a sign named "Discord Town".',
    },
    { speaker: "Nate", text: "Discord?" },
    {
      speaker: "Narrator",
      text: "Nate goes inside the town.",
      action: () => {
        displayOptions([
          {
            text: "Explore Discord Town",
            action: () => advanceScene("enterWarzoneBuilding"),
          },
        ]);
      },
    },
  ],
  enterWarzoneBuilding: [
    {
      speaker: "Narrator",
      text: "He walks for some time until he sees a building.",
    },
    { speaker: "Nate", text: "Warzone? It can't be." },
    { speaker: "Narrator", text: "Nate enters the building." },
    {
      speaker: "Narrator",
      text: "Inside the building, there seems to be couple of people.",
    },
    { speaker: "Narrator", text: "Vallrak, Redslime, boruto" },
    { speaker: "Nate", text: "Wait, i remember thi-" },
    { speaker: "Redslime", text: "So this is the server?" },
    {
      speaker: "Boruto",
      text: "Yup! So now that you got unbanned lets play again!",
    },
    { speaker: "Nate", text: "..." },
    { speaker: "Narrator", text: "Boruto and red hop into a portal. " },
    { speaker: "Nate", text: "Im soo confused" },
    { speaker: "Narrator", text: "Vallrak has seemed to notice nate." },
    {
      speaker: "Vallrak",
      text: "Hey, you new?",
      options: [
        { text: "YES", action: () => advanceScene("vallrakLie") },
        { text: "NO", action: () => advanceScene("vallrakTruth") },
      ],
    },
  ],
  vallrakLie: [
    {
      speaker: "Vallrak",
      text: "Really? You seem new.",
      action: () => setTimeout(() => advanceScene("vallrakTruth"), 2000),
    },
  ],
  vallrakTruth: [
    { speaker: "Nate", text: "Im kind of new i guess" },
    { speaker: "Vallrak", text: "you play minecraft?" },
    { speaker: "Nate", text: "Well not that much, only with my friend." },
    { speaker: "Vallrak", text: "Dope. so get the ip in [IP LINK]" },
    { speaker: "Nate", text: "Cool! ill join later" },
    { speaker: "Vallrak", text: "K." },
    {
      speaker: "System",
      text: "Join server?",
      options: [{ text: "YES", action: () => advanceScene("warzoneJoin") }],
    },
  ],
  warzoneJoin: [
    {
      speaker: "Narrator",
      text: "Nate, staring at the portal which Red and boruto went to",
    },
    { speaker: "Narrator", text: "Decides to hop in." },
    {
      speaker: "System",
      text: "",
      action: () => {
        advanceScene("joinedWarzone");
      },
    },
  ],
  joinedWarzone: [
    { speaker: "System", text: "...", typingSpeed: 150 },
    { speaker: "Nate", text: "The spawn is still as good as i remember it." },
    {
      speaker: "Nate",
      text: "Old times, nostalgic",
      action: () => setTimeout(() => {}, 1000),
    },
    {
      speaker: "Narrator",
      text: "Nate gets interrupted by Redslime and boruto",
    },
    { speaker: "Redslime", text: "so this is it? i heard the end's open here" },
    { speaker: "Boruto", text: "Yup! and there's an enderman farm there!" },
    { speaker: "Redslime", text: "Cool. so basically free money?" },
    { speaker: "Boruto", text: "Yeah, So uh ill show you around" },
    { speaker: "Nate", text: "This is not how i expected my day to be." },
    { speaker: "Redslime", text: "Hey, you. You seem new." },
    { speaker: "Nate", text: "Crap." },
    {
      speaker: "Narrator",
      text: "Nate decides to face RedSlime, thinking about what he should say next.",
    },
    { speaker: "Redslime", text: "What's your name?" },
    { speaker: "Nate", text: "Nate." },
    { speaker: "Redslime", text: "Hey cool! You got the same name as me!" },
    { speaker: "Nate", text: "..." },
    { speaker: "RedSlime", text: "Well then ya new to the game i suppose?" },
    { speaker: "Nate", text: "Yeah, im new." },
    {
      speaker: "Redslime",
      text: "Well then come around, here ill teach ya how to fight!",
    },
    { speaker: "Narrator", text: "RedSlime summons a goblin." },
    { speaker: "Redslime", text: "Heres a basic goblin, ill fight with you." },
    {
      speaker: "Redslime",
      text: "Fight it.",
      options: [
        {
          text: "FIGHT",
          action: () =>
            startFight(["Nate", "Redslime"], ["Goblin"], "killedGoblin"),
        },
      ],
    },
  ],
  killedGoblin: [
    { speaker: "Narrator", text: "Nate successfully kills the goblin." },
    { speaker: "Redslime", text: "Eyyy, thats good!" },
    { speaker: "Nate", text: "Thanks." },
    { speaker: "Redslime", text: "K then i'll be heading my way" },
    {
      speaker: "Narrator",
      text: "While redslime teleports to the end farm, Boruto stays behind.",
    },
    { speaker: "Boruto", text: "Got a lot of questions, dont ya. Nate?" },
    { speaker: "Nate", text: "Yes??. But you wo-" },
    {
      speaker: "Boruto",
      text: "Your in the mindscape. A place where all of imagination exists.",
    },
    {
      speaker: "Boruto",
      text: "It contains dreams, stories, ideas and whatnot.",
    },
    { speaker: "Nate", text: "What?" },
    {
      speaker: "Boruto",
      text: "In simple terms, you slept into another dimension.",
    },
    {
      speaker: "Narrator",
      text: "Boruto takes a lollipop from his pocket and hands it to nate",
    },
    {
      speaker: "Boruto",
      text: "Here, have it. You'll be hungry when you wake up",
    },
    { speaker: "Nate", text: "????????????????", skip: true },
    {
      speaker: "Narrator",
      text: "Nate wakes up, his keyboard backlight still lit up",
    },
    { speaker: "Narrator", text: "Someone knocks at his room door" },
    { speaker: "Mom", text: "Hey Nate, if you woke up." },
    { speaker: "Mom", text: "I made pizza, your favorite!" },
    { speaker: "Narrator", text: "Nate stands up from his keyboard" },
    { speaker: "Nate", text: "Huh?" },
    { speaker: "Narrator", text: "Nate notices something in his pocket." },
    {
      speaker: "Narrator",
      text: "He takes it out. revealing to be the lollipop",
    },
    { speaker: "Narrator", text: "He puts it in his mouth." },
    { speaker: "Nate", text: "I have no idea what the hell is going on." },
    {
      speaker: "Mom",
      text: "Oh yeah your classmates Sue and Ben are coming for a sleepover",
    },
    { speaker: "Nate", text: "WHAT?!", typingSpeed: 15 },
    { speaker: "Nate", text: "I dont like em, Especially ben!" },
    { speaker: "Nate", text: "He's annoying!" },
    {
      speaker: "Mom",
      text: "Well they're coming, Nothing we can do bout that.",
    },
    {
      speaker: "Nate",
      text: "For god's sake.",
      action: () => {
        showObjective("GO TO LIVING ROOM");
        displayOptions([
          {
            text: "Go to room",
            action: () => advanceScene("livingRoomCousinsMeetup"),
          },
        ]);
      },
    },
  ],
  livingRoomCousinsMeetup: [
    { speaker: "Nate", text: "i need a break-" },
    { speaker: "Narrator", text: "Suddenly the front door bursts open" },
    {
      speaker: "Ben",
      text: "YEAHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH",
      typingSpeed: 1,
      skip: true,
    },
    { speaker: "Sue", text: "Ben chillax." },
    { speaker: "Nate", text: "hi ben..." },
    { speaker: "Ben", text: "SUP!!!!" },
    { speaker: "Nate", text: "Is he always filled with sugar or something." },
    { speaker: "Sue", text: "Sup." },
    { speaker: "Nate", text: "Sup." },
    { speaker: "Mom", text: "Come in, come in!" },
    { speaker: "Nate", text: "Oh well." },
    {
      speaker: "Narrator",
      text: "Nate goes to drink water, and Sue talks to his mother.",
    },
    {
      speaker: "Narrator",
      text: "While ben's just looting food from the fridge.",
    },
    { speaker: "Sue", text: "He dosent really like school that much" },
    { speaker: "Sue", text: "He just looks in the distance." },
    { speaker: "Sue", text: "Yet i hear he gets good marks." },
    { speaker: "Mom", text: "Only when he wants to get marks." },
    {
      speaker: "Mom",
      text: "He sometimes fails and i know he could learn it if he wanted to.",
    },
    { speaker: "Mom", text: "He just dosent seem..." },
    { speaker: "Sue", text: "Interested. He dosent seem interested." },
    { speaker: "Mom", text: "Exactly! Oh wait i prepared some snacks for you" },
    {
      speaker: "Narrator",
      text: "Mom goes back to the kitchen to get a tray of snacks",
    },
    { speaker: "Mom", text: "Dig in!" },
    {
      speaker: "Narrator",
      text: "Ben, eyeing the sweets. Decides to rush over the table",
    },
    { speaker: "Ben", text: "First!" },
    { speaker: "Mom", text: "Woah easy! No rush" },
    {
      speaker: "Narrator",
      text: "Nate comes back from with a glass of water in his hand",
    },
    { speaker: "Nate", text: "Ben, go slow. you'll choke" },
    { speaker: "Ben", text: "But i wanna eat!!!!!!!!!!!" },
    { speaker: "Nate", text: "Jeez fine, eat." },
    { speaker: "Ben", text: "WEEEEEEEEEEEEEE" },
    {
      speaker: "Narratror",
      text: "Ben, digs through the food. While nate thinks about last night",
    },
    { speaker: "Nate", text: "What the hell was that." },
    { speaker: "Nate", text: "Was that me... Before everything?" },
    { speaker: "Mom", text: "Ok so-" },
    {
      speaker: "Narrator",
      text: "Nate and the others sit down to talk for hours.",
    },
    { speaker: "Narrator", text: "Sue notices that its getting dark." },
    { speaker: "Sue", text: "We should sleep." },
    { speaker: "Nate", text: "Eh? but we're only gettin-" },
    { speaker: "Nate", text: "Oh its dark. Well FINE." },
    {
      speaker: "Narrator",
      text: "Ben seemingly slept on the couch sometime while talking.",
    },
    { speaker: "Nate", text: "Are we just going to leave him here?" },
    { speaker: "Sue", text: "Let him sleep on the cough" },
    { speaker: "Mom", text: "One second, ill be right back!" },
    {
      speaker: "Narrator",
      text: "Mom rushes to get a pillow. While nate and sue are tired",
    },
    {
      speaker: "Nate",
      text: "Im going back to my room, Mom will tell ya where to sleep.",
    },
    { speaker: "Sue", text: "K See ya bro." },
  ],
};

// --- Game Logic Functions ---

function typeWriter(
  text,
  element,
  { typingSpeed = 35, jumble = false } = {},
  onComplete,
) {
  clearTimeout(typingTimeout);
  let i = 0;
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!#$%&'()*+,-./:;<=>?@[\\]^_`{|}~";
  element.innerHTML = "";

  function type() {
    if (i < text.length) {
      const substr = text.substring(i);

      // Handle tags
      if (substr.startsWith("<strong>")) {
        element.innerHTML += "<strong>";
        i += "<strong>".length;
        return type();
      } else if (substr.startsWith("</strong>")) {
        element.innerHTML += "</strong>";
        i += "</strong>".length;
        return type();
      } else if (substr.startsWith('<span class="speaker">')) {
        const tag = '<span class="speaker">';
        element.innerHTML += tag;
        i += tag.length;
        return type();
      } else if (substr.startsWith("</span>")) {
        element.innerHTML += "</span>";
        i += "</span>".length;
        return type();
      }

      // Typing logic
      if (jumble && i > 0 && Math.random() > 0.1) {
        const cleanText = element.innerText; // prevents breaking tags
        const jumbledContent = cleanText
          .split("")
          .map((c) =>
            Math.random() > 0.1
              ? chars[Math.floor(Math.random() * chars.length)]
              : c,
          )
          .join("");
        element.innerText = jumbledContent + text.charAt(i);
      } else {
        element.innerHTML += text.charAt(i);
      }

      // Play sound safely (clone to avoid cutoff)
      if (typeof beepSound !== "undefined") {
        const sound = beepSound.cloneNode();
        sound.volume = 0.3;
        sound.play();
      }

      i++;
      const currentChar = text.charAt(i - 1);
      let delay = typingSpeed;

      // Add pauses for punctuation
      if (currentChar === "." || currentChar === "!") delay *= 8;
      else if (currentChar === "," || currentChar === ";") delay *= 4;
      else if (currentChar === "?" || currentChar === ":") delay *= 6;

      typingTimeout = setTimeout(type, delay);
    } else {
      if (onComplete) onComplete();
    }
  }

  type();
}

function displayDialogue(line) {
  textLineElement.className = "";

  let textForTypewriter = "";
  if (line.speaker === "Narrator") {
    textLineElement.classList.add("narrator-text");
    textForTypewriter = line.text;
  } else if (line.speaker === "Darkness") {
    textLineElement.classList.add("darkness-text");
    textForTypewriter = line.text;
  } else if (line.speaker && line.speaker !== "System") {
    textForTypewriter = `<span class="speaker">${line.speaker}:</span> ${line.text}`;
  } else {
    textForTypewriter = line.text;
  }

  const typingOptions = {
    typingSpeed: line.typingSpeed || 35,
    jumble: line.jumble || false,
  };

  if (line.effect === "crt") {
    textLineElement.classList.add("crt-flicker", "crt-scanlines");

    setTimeout(() => {
      textLineElement.classList.remove("crt-flicker", "crt-scanlines");
    }, 2000);
  }

  typeWriter(textForTypewriter, textLineElement, typingOptions, () => {
    if (
      !line.options &&
      !line.skip &&
      optionsContainer.innerHTML.trim() === "" &&
      dialogueIndex < script[currentScene].length - 1
    ) {
      displayOptions([
        {
          text: "Next >",
          action: () => {
            dialogueIndex++;
            localStorage.setItem("scene", currentScene);
            localStorage.setItem("dialogueIndex", dialogueIndex);

            loadDialogue();
          },
        },
      ]);
    }

    if (line.skip) {
      dialogueIndex++;
      localStorage.setItem("scene", currentScene);
      localStorage.setItem("dialogueIndex", dialogueIndex);

      loadDialogue();
    }
  });

  if (line.options) {
    displayOptions(line.options);
  }
}
function displayOptions(options) {
  optionsContainer.innerHTML = "";
  options.forEach((option) => {
    const button = document.createElement("button");
    button.textContent = option.text;
    button.onclick = () => {
      checkmate.play();
      if (typeof option.action === "function") {
        option.action();
      }
    };
    optionsContainer.appendChild(button);
  });
}

function advanceScene(nextScene) {
  currentScene = nextScene;
  dialogueIndex = 0;
  objectiveBox.style.display = "none";
  optionsContainer.innerHTML = "";
  localStorage.setItem("scene", nextScene);

  const firstLineOfNewScene = script[currentScene]?.[0];
  if (firstLineOfNewScene?.effect) {
    handleEffect(firstLineOfNewScene.effect, () => loadDialogue());
  } else {
    loadDialogue();
  }
}

function handleEffect(effectName, callback) {
  textLineElement.classList.remove("glitch", "fade-in", "fade-out");
  gameContainer.classList.remove("fade-in", "fade-out");

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

    default:
      if (callback) callback();
      break;
  }
}

function showObjective(text) {
  objectiveBox.textContent = `OBJECTIVE: ${text}`;
  objectiveBox.style.display = "block";
}

function loadDialogue() {
  clearTimeout(typingTimeout);
  optionsContainer.innerHTML = "";

  if (!script[currentScene] || !script[currentScene][dialogueIndex]) {
    console.error(
      `Scene or dialogue index out of bounds: ${currentScene}[${dialogueIndex}]`,
    );
    textLineElement.innerHTML = "<p>[End of current script path or error]</p>";
    displayOptions([
      {
        text: "Restart Intro",
        action: () => {
          currentScene = "intro";
          dialogueIndex = 0;
          objectiveBox.style.display = "none";
          loadDialogue();
        },
      },
    ]);
    return;
  }

  const line = script[currentScene][dialogueIndex];

  if (line.action && !line.text && !line.options) {
    const sceneBeforeAction = currentScene;
    const indexBeforeAction = dialogueIndex;
    if (typeof line.action === "function") {
      line.action();
    }
    if (
      currentScene === sceneBeforeAction &&
      dialogueIndex === indexBeforeAction
    ) {
      if (dialogueIndex < script[currentScene].length - 1) {
        dialogueIndex++;
        localStorage.setItem("scene", currentScene);
        localStorage.setItem("dialogueIndex", dialogueIndex);

        loadDialogue();
      }
    }
    return;
  }

  if (line.action && (line.text || line.options)) {
    if (typeof line.action === "function") {
      line.action();
    }
  }
  displayDialogue(line);
}

// --- Fight System Functions ---

function startFight(alliesNames, enemyNames, victoryScene, defeatScene = null) {
  inFight = true;
  currentFightEnemies = enemyNames.map((name) => ({
    ...characters[name],
    name,
  }));
  currentFightAllies = alliesNames.map((name) => ({
    ...characters[name],
    name,
  }));
  currentFightVictoryScene = victoryScene || null;
  currentDefeatScene = defeatScene || null;

  localStorage.setItem("scene", currentScene);

  document.getElementById("fightOverlay").style.display = "block";
  renderFightScene();

  dialogueBox.style.display = "none";
  optionsContainer.style.display = "none";
  objectiveBox.style.display = "none";
}

function endFight(victory) {
  inFight = false;
  document.getElementById("fightOverlay").style.display = "none";

  dialogueBox.style.display = "block";
  optionsContainer.style.display = "flex";

  if (victory) {
    if (currentFightVictoryScene) {
      advanceScene(currentFightVictoryScene);
    } else {
      if (currentDefeatScene == null) {
        advanceScene(localStorage.getItem("scene") || "intro");
      } else {
        advanceScene(currentDefeatScene);
      }
    }
  } else {
    if (currentDefeatScene == null) {
      advanceScene(localStorage.getItem("scene") || "intro");
    } else {
      advanceScene(currentDefeatScene);
    }
  }

  mana = 0;
  updateMana(0);
}

function updateMana(change = 0) {
  mana = Math.min(100, Math.max(0, mana + change));
  const manaBar = document.getElementById("manaBar");
  if (manaBar) {
    manaBar.style.width = mana + "%";
    manaBar.textContent = Math.floor(mana) + "%";
  }
}

function renderFightScene() {
  const arena = document.getElementById("fightArena");
  arena.innerHTML = "";

  currentFightAllies.forEach((ally) => {
    const cube = document.createElement("div");
    cube.className = "character-cube";
    cube.style.backgroundColor = characters[ally.name].color;
    cube.dataset.name = ally.name;
    cube.dataset.type = "ally";

    const health = document.createElement("div");
    health.className = "character-health";
    health.textContent = `${ally.name}: ${ally.health} HP`;
    health.id = `health-${ally.name}`;

    cube.appendChild(health);
    arena.appendChild(cube);
  });

  currentFightEnemies.forEach((enemy) => {
    const cube = document.createElement("div");
    cube.className = "character-cube";
    cube.style.backgroundColor = characters[enemy.name].color;
    cube.dataset.name = enemy.name;
    cube.dataset.type = "enemy";

    const health = document.createElement("div");
    health.className = "character-health";
    health.textContent = `${enemy.name}: ${enemy.health} HP`;
    health.id = `health-${enemy.name}`;

    cube.appendChild(health);
    arena.appendChild(cube);
  });

  setupFightOptions();
}

function setupFightOptions() {
  const fightOptions = document.getElementById("fightOptions");
  const subOptions = document.getElementById("fightSuboptions");
  subOptions.style.display = "none";
  subOptions.innerHTML = "";

  Array.from(fightOptions.children).forEach((button) => {
    button.onclick = () => handleFightAction(button.dataset.action);
  });
}

function handleFightAction(action) {
  const subOptions = document.getElementById("fightSuboptions");

  switch (action) {
    case "fight":
      selectedAction = "fight";
      subOptions.innerHTML = currentFightAllies
        .map(
          (ally) =>
            `<button class="item-option" data-ally="${ally.name}">${ally.name} (${ally.damage} DMG)</button>`,
        )
        .join("");
      subOptions.style.display = "flex";
      break;

    case "act":
      if (mana <= 0) {
        showActionMessage("You need some mana to perform an ACT!");
        return;
      }

      selectedAction = "act";
      subOptions.innerHTML = currentFightAllies
        .filter((a) => a.isPlayer && a.act)
        .map(
          (a) =>
            `<button class="item-option" data-ally="${a.name}">${a.name}</button>`,
        )
        .join("");
      subOptions.style.display = "flex";
      break;

    case "defend":
      showActionMessage("You defend against the next attack!");
      setTimeout(() => enemyTurn(), 1500);
      break;

    case "flee":
      if (Math.random() > 0.5) {
        endFight(false);
        showActionMessage("You fled successfully!");
      } else {
        showActionMessage("Failed to flee!");
        setTimeout(() => enemyTurn(), 1500);
      }
      break;
  }

  Array.from(subOptions.children).forEach((button) => {
    button.onclick = () => {
      if (selectedAction === "fight") {
        selectedTarget = button.dataset.ally;
        showActionMessage(`Select a target for ${selectedTarget}'s attack!`);
        setupTargetSelection();
      } else if (selectedAction === "act") {
        const actorName = button.dataset.ally;
        const actor = currentFightAllies.find((a) => a.name === actorName);
        if (!actor || !actor.act) return;

        const { damage, heal } = actor.act;
        if (damage && heal) {
          // both exist → choose which
          subOptions.innerHTML = `
            <button class="item-option" data-act="damage" data-actor="${actorName}">Damage (${damage.mana}% MANA)</button>
            <button class="item-option" data-act="heal" data-actor="${actorName}">Heal (${heal.mana}% MANA)</button>
          `;
        } else if (damage) {
          subOptions.innerHTML = `
            <button class="item-option" data-act="damage" data-actor="${actorName}">Damage (${damage.mana}% MANA)</button>
          `;
        } else if (heal) {
          subOptions.innerHTML = `
            <button class="item-option" data-act="heal" data-actor="${actorName}">Heal (${heal.mana}% MANA)</button>
          `;
        }

        Array.from(subOptions.children).forEach((btn) => {
          btn.onclick = () => performAct(actorName, btn.dataset.act);
        });
      }
    };
  });
}

function setupTargetSelection(isHeal = false) {
  const cubes = document.querySelectorAll(".character-cube");
  cubes.forEach((cube) => {
    if (
      (isHeal && cube.dataset.type === "ally") ||
      (!isHeal && cube.dataset.type === "enemy")
    ) {
      cube.style.border = "2px solid yellow";
      cube.style.cursor = "pointer";
      cube.onclick = () => {
        if (selectedAction === "fight") {
          startTimingMiniGame(cube.dataset.name);
        } else if (selectedAction === "use") {
          useItemOnTarget(cube.dataset.name);
        } else if (
          selectedAction === "act_damage" ||
          selectedAction === "act_heal"
        ) {
          actOnTarget(cube.dataset.name);
        } else {
          cube.style.border = "none";
          cube.style.cursor = "default";
          cube.onclick = null;
        }
      };
    }
  });
}
function actOnTarget(targetName) {
  const { actorName, value } = selectedTarget;
  const type = selectedAction === "act_heal" ? "heal" : "damage";

  if (type === "damage") {
    dealDamage(targetName, value);
    showActionMessage(
      `${actorName} used ACT to deal ${value} damage to ${targetName}!`,
    );
  } else {
    const targetChar = currentFightAllies.find((a) => a.name === targetName);
    if (targetChar) {
      targetChar.health = Math.min(
        targetChar.health + value,
        characters[targetName].health,
      );
      showActionMessage(
        `${actorName} used ACT to heal ${targetName} for ${value} HP!`,
      );
    }
  }
  setTimeout(() => enemyTurn(), 1000);
}

function startTimingMiniGame(target) {
  const timingBar = document.getElementById("timingBar");
  timingBar.style.display = "block";

  const indicator = timingBar.querySelector(".timing-indicator");
  indicator.style.animation = "timingSwing 1.2s infinite linear";

  timingBar.onclick = () => {
    const indicator = timingBar.querySelector(".timing-indicator");
    const perfectZone = timingBar.querySelector(".perfect-zone");

    const indicatorRect = indicator.getBoundingClientRect();
    const perfectZoneRect = perfectZone.getBoundingClientRect();

    const perfectCenter = perfectZoneRect.left + perfectZoneRect.width / 2;
    const indicatorCenter = indicatorRect.left + indicatorRect.width / 2;
    const distanceFromPerfect = Math.abs(perfectCenter - indicatorCenter);
    const maxDistance = timingBar.offsetWidth - perfectZoneRect.width;

    let damageMultiplier = 1;
    let message = "Hit!";

    if (distanceFromPerfect < perfectZoneRect.width / 2) {
      damageMultiplier = 1;
      message = "PERFECT HIT! Massive damage!";
    } else {
      const accuracy = 1 - distanceFromPerfect / maxDistance;
      damageMultiplier = Math.max(0.2, accuracy);
      message =
        accuracy > 0.7
          ? "Good hit!"
          : accuracy > 0.4
            ? "Weak hit!"
            : "Poor hit!";
    }

    const baseDamage = characters[selectedTarget].damage;
    const finalDamage = Math.round(baseDamage * damageMultiplier);

    dealDamage(target, finalDamage);
    showActionMessage(`${message} (${finalDamage} damage)`);

    timingBar.style.display = "none";
    timingBar.onclick = null;
    resetFightUI();
    setTimeout(() => enemyTurn(), 1000);
  };
}

function useItemOnTarget(target) {
  if (selectedItem.type === "health") {
    const targetChar =
      currentFightAllies.find((a) => a.name === target) ||
      currentFightEnemies.find((e) => e.name === target);

    if (targetChar) {
      targetChar.health = Math.min(
        targetChar.health + selectedItem.value,
        characters[target].health,
      );
      showActionMessage(`${target} healed for ${selectedItem.value} HP!`);
      showDamageEffect(target);
    }
  } else if (selectedItem.type === "damage") {
    dealDamage(target, selectedItem.value);
  }

  items = items.filter((item) => item !== selectedItem);
  resetFightUI();
  setTimeout(() => enemyTurn(), 1000);
}

function performAct(actorName, type) {
  const actor = currentFightAllies.find((a) => a.name === actorName);
  if (!actor || !actor.act || !actor.act[type]) return;

  const actData = actor.act[type];
  const manaCost = actData.mana || 0;

  if (mana < manaCost) {
    showActionMessage(`Not enough mana! Need ${manaCost}%`);
    return;
  }

  const valueRaw = actData.amount;
  let value = 0;
  if (typeof valueRaw === "string" && valueRaw.includes("-")) {
    const [min, max] = valueRaw.split("-").map(Number);
    value = Math.floor(Math.random() * (max - min + 1)) + min;
  } else {
    value = Number(valueRaw);
  }

  updateMana(-manaCost);

  if (type === "damage") {
    showActionMessage(
      `Select an enemy to deal ${value} damage! (-${manaCost}% mana)`,
    );
    selectedAction = "act_damage";
    selectedTarget = { actorName, value };
    setupTargetSelection(false);
  } else if (type === "heal") {
    showActionMessage(
      `Select an ally to heal ${value} HP! (-${manaCost}% mana)`,
    );
    selectedAction = "act_heal";
    selectedTarget = { actorName, value };
    setupTargetSelection(true);
  }
}

function showDamageEffect(characterName) {
  const healthElement = document.getElementById(`health-${characterName}`);
  if (!healthElement) return;

  healthElement.style.color = "#ff0000";
  setTimeout(() => {
    healthElement.style.color = "#ffffff";
    renderFightScene();
  }, 300);
}

function showHealEffect(characterName) {
  const healthElement = document.getElementById(`health-${characterName}`);
  if (!healthElement) return;

  healthElement.style.color = "#00ff00";
  setTimeout(() => {
    healthElement.style.color = "#ffffff";
    renderFightScene();
  }, 300);
}

function dealDamage(target, amount) {
  showDamageEffect(target);

  setTimeout(() => {
    if (currentFightEnemies.some((e) => e.name === target)) {
      const enemy = currentFightEnemies.find((e) => e.name === target);
      enemy.health -= amount;

      if (enemy.health <= 0) {
        showMessage(`${target} was defeated!`);
        currentFightEnemies = currentFightEnemies.filter(
          (e) => e.name !== target,
        );
      }
    } else {
      const ally = currentFightAllies.find((a) => a.name === target);
      if (ally) {
        ally.health -= amount;

        if (ally.health <= 0) {
          showActionMessage(`${target} was knocked out!`);
          currentFightAllies = currentFightAllies.filter(
            (a) => a.name !== target,
          );
        }
      }
    }

    if (currentFightAllies.some((a) => a.name === target)) {
      updateMana(5);
    } else {
      updateMana(5);
    }

    renderFightScene();

    if (currentFightEnemies.length === 0) {
      setTimeout(() => endFight(true), 1000);
    } else if (currentFightAllies.length === 0) {
      setTimeout(() => endFight(false), 1000);
    }
  }, 300);
}

function enemyTurn() {
  if (!inFight || currentFightEnemies.length === 0) return;

  currentFightEnemies.forEach((enemy, index) => {
    if (currentFightAllies.length > 0) {
      setTimeout(() => {
        const randomAlly =
          currentFightAllies[
            Math.floor(Math.random() * currentFightAllies.length)
          ];
        const damage = Math.max(
          1,
          enemy.damage - Math.floor(Math.random() * 5),
        );

        dealDamage(randomAlly.name, damage);

        enemy.health += Math.floor(Math.random() * 7) + 1;
        showHealEffect(enemy.name);

        showActionMessage(
          `${enemy.name} attacks ${randomAlly.name} for ${damage} damage!`,
        );
      }, index * 1500);
    }
  });
}

function resetFightUI() {
  const subOptions = document.getElementById("fightSuboptions");
  subOptions.style.display = "none";
  subOptions.innerHTML = "";

  const cubes = document.querySelectorAll(".character-cube");
  cubes.forEach((cube) => {
    cube.style.border = "none";
    cube.style.cursor = "default";
    cube.onclick = null;
  });

  selectedAction = null;
  selectedItem = null;
  selectedTarget = null;
}

window.onload = () => {
  // localStorage.setItem('scene', 'intro')
  // localStorage.setItem('dialogueIndex', '0')
  document.getElementById("fightOptions").addEventListener("click", (e) => {
    if (e.target.classList.contains("fight-option")) {
      handleFightAction(e.target.dataset.action);
    }
  });

  const savedScene = localStorage.getItem("scene");
  const savedIndex = localStorage.getItem("dialogueIndex");

  if (savedScene && script[savedScene]) {
    currentScene = savedScene;
    dialogueIndex = savedIndex ? parseInt(savedIndex, 10) : 0;
  } else {
    currentScene = "intro";
    dialogueIndex = 0;
    localStorage.setItem("scene", "intro");
    localStorage.setItem("dialogueIndex", "0");
  }

  // Load the corresponding dialogue
  if (script[currentScene]?.[dialogueIndex]) {
    const firstLine = script[currentScene][dialogueIndex];
    if (firstLine.effect) {
      handleEffect(firstLine.effect, () => loadDialogue());
    } else {
      loadDialogue();
    }
  } else {
    // Fallback if script or dialogue index doesn't exist
    currentScene = "intro";
    dialogueIndex = 0;
    localStorage.setItem("scene", "intro");
    localStorage.setItem("dialogueIndex", "0");

    textLineElement.innerHTML = "<p>Welcome to the game!</p>";
    displayOptions([
      {
        text: "Start Game",
        action: () => advanceScene("intro"),
      },
    ]);
  }
};
