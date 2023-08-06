(function (){
    console.log("[init.js]: Running!")
    const World = new world({
        element: document.querySelector(".game-container")
    })
    World.init();
})();