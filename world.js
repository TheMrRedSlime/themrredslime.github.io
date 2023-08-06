class world {
    constructor(config) {
      this.element = config.element;
      this.canvas = this.element.querySelector(".game-canvas");
      this.ctx = this.canvas.getContext("2d");
      
      this.x = 0;
      this.y = 0;
    }
    
    init() {
      console.log("[world.js]: Running!", this);
  
      const image = new Image();
      image.onload = () => {
        this.ctx.drawImage(image, 0, 0);
      };
      image.src = "map.png";
  
      const plr = new Image();
      plr.onload = () => {
        this.ctx.drawImage(plr, 0, 0, 16, 16, this.x, this.y, 16, 16);
      };
      plr.src = "player.png";
  
      document.onkeydown = (key) => {
        if (key.keyCode === 68) {
          console.log(`X : ${this.x} / Z: ${this.y}`)
          this.x += 16;
          console.log(`X : ${this.x} / Z: ${this.y}`)
        }else if (key.keyCode === 65) {
          console.log(`X : ${this.x} / Z: ${this.y}`)
          this.x -= 16;
          console.log(`X : ${this.x} / Z: ${this.y}`)
        }else if (key.keyCode === 87) {
          console.log(`X : ${this.x} / Z: ${this.y}`)
          this.y -= 16;
        }else if (key.keyCode === 83) {
          console.log(`X : ${this.x} / Z: ${this.y}`)
          this.y += 16;
        }else if (key.keyCode === 192) {
          this.ctx.drawImage(plr, 0, 0);
        }

        if(this.x > 144){
            this.x -= 16;
        }
        if(this.y > 144){
            this.y -= 16;
        }
        if(this.x < 0){
            this.x += 16;
        }
        if(this.y < 0){
            this.y += 16;
        }
        // redraw player at new position
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.drawImage(image, 0, 0);
        this.ctx.drawImage(plr, 0, 0, 16, 16, this.x, this.y, 16, 16);
      };
    }
  }
