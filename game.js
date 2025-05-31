// Helpy's Advanced Web Game: Top-down Action RPG Demo
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startBtn = document.getElementById('startBtn');
const msgDiv = document.getElementById('msg');

// Game constants
const TILE = 40;
const MAP_W = 20;
const MAP_H = 12;
const PLAYER_SPEED = 3;
const ENEMY_SPEED = 1.5;
const ATTACK_RANGE = 36;
const ITEM_SIZE = 24;

// Game state
let map, player, enemies, items, projectiles, running, gameOver, keys, tick, camera;

function resetGame() {
  // Simple map: 0-empty, 1-wall
  map = Array.from({length: MAP_H}, (_, y) =>
    Array.from({length: MAP_W}, (_, x) => (x === 0 || x === MAP_W-1 || y === 0 || y === MAP_H-1) ? 1 : 0)
  );
  player = {
    x: 2.5 * TILE, y: 2.5 * TILE, r: 18, hp: 30, maxHp: 30, atk: 5, exp: 0, lv: 1, items: [],
    color: '#4af', dir: 0, invul: 0, score: 0
  };
  enemies = [
    {x: 12*TILE, y: 5*TILE, r: 18, hp: 12, maxHp: 12, atk: 3, color:'#e55', ai:'chase', cd:0},
    {x: 15*TILE, y: 9*TILE, r: 18, hp: 20, maxHp: 20, atk: 5, color:'#fa0', ai:'ranged', cd:0}
  ];
  items = [
    {x: 7*TILE, y: 3*TILE, type:'heal', name:'Potion', effect:()=>{player.hp=Math.min(player.maxHp,player.hp+10);}},
    {x: 17*TILE, y: 10*TILE, type:'atk', name:'Sword', effect:()=>{player.atk+=3;}}
  ];
  projectiles = [];
  running = true;
  gameOver = false;
  keys = {};
  tick = 0;
  camera = {x:0, y:0};
  msgDiv.textContent = '';
  draw();
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // Camera follows player
  camera.x = Math.max(0, Math.min(player.x - canvas.width/2, MAP_W*TILE-canvas.width));
  camera.y = Math.max(0, Math.min(player.y - canvas.height/2, MAP_H*TILE-canvas.height));
  // Draw map
  for(let y=0;y<MAP_H;y++) for(let x=0;x<MAP_W;x++) {
    ctx.fillStyle = map[y][x]===1 ? '#222' : '#3a3';
    ctx.fillRect(x*TILE-camera.x, y*TILE-camera.y, TILE, TILE);
  }
  // Items
  for(const it of items) {
    ctx.fillStyle = it.type==='heal' ? '#0f0' : '#fa0';
    ctx.beginPath();
    ctx.arc(it.x+TILE/2-camera.x, it.y+TILE/2-camera.y, ITEM_SIZE/2, 0, 2*Math.PI);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '12px sans-serif';
    ctx.fillText(it.name, it.x+TILE/2-16-camera.x, it.y+TILE/2+18-camera.y);
  }
  // Projectiles
  for(const p of projectiles) {
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x-camera.x, p.y-camera.y, 7, 0, 2*Math.PI);
    ctx.fill();
  }
  // Enemies
  for(const e of enemies) {
    ctx.fillStyle = e.color;
    ctx.beginPath();
    ctx.arc(e.x-camera.x, e.y-camera.y, e.r, 0, 2*Math.PI);
    ctx.fill();
    // HP bar
    ctx.fillStyle = '#0f0';
    ctx.fillRect(e.x-e.r-camera.x, e.y-e.r-12-camera.y, (e.hp/e.maxHp)*e.r*2, 6);
  }
  // Player
  ctx.save();
  ctx.translate(player.x-camera.x, player.y-camera.y);
  ctx.rotate(player.dir);
  ctx.fillStyle = player.color;
  ctx.beginPath();
  ctx.arc(0,0,player.r,0,2*Math.PI);
  ctx.fill();
  ctx.restore();
  // Player HP/EXP
  ctx.fillStyle = '#fff';
  ctx.font = '18px sans-serif';
  ctx.fillText(`HP: ${player.hp}/${player.maxHp}  LV: ${player.lv}  EXP: ${player.exp}  ATK: ${player.atk}  SCORE: ${player.score}`, 16, 28);
  ctx.fillText(`Items: ${player.items.map(i=>i.name).join(', ')}`, 16, 52);
}

function update() {
  tick++;
  // Player movement
  let dx=0, dy=0;
  if(keys['ArrowLeft']||keys['a']) dx=-1;
  if(keys['ArrowRight']||keys['d']) dx=1;
  if(keys['ArrowUp']||keys['w']) dy=-1;
  if(keys['ArrowDown']||keys['s']) dy=1;
  if(dx||dy) {
    let len = Math.hypot(dx,dy);
    dx/=len; dy/=len;
    let nx = player.x + dx*PLAYER_SPEED;
    let ny = player.y + dy*PLAYER_SPEED;
    if(!isWall(nx,ny,player.r)) { player.x=nx; player.y=ny; }
    player.dir = Math.atan2(dy,dx);
  }
  // Pick up items
  for(let i=items.length-1;i>=0;i--) {
    let it = items[i];
    if(dist(player,it)<player.r+ITEM_SIZE/2) {
      it.effect();
      player.items.push(it);
      msgDiv.textContent = `획득: ${it.name}!`;
      items.splice(i,1);
    }
  }
  // Attack (Space)
  if(keys[' '] && !player.attackCd) {
    for(const e of enemies) {
      if(dist(player,e)<player.r+e.r+ATTACK_RANGE) {
        e.hp -= player.atk;
        msgDiv.textContent = `공격! ${player.atk} 데미지!`;
        if(e.hp<=0) {
          player.exp+=5; player.score+=10;
        }
      }
    }
    player.attackCd=20;
  }
  if(player.attackCd) player.attackCd--;
  // Level up
  if(player.exp>=10*player.lv) {
    player.lv++; player.maxHp+=5; player.hp=player.maxHp; player.atk+=2; player.exp=0;
    msgDiv.textContent = `레벨업! LV.${player.lv}`;
  }
  // Enemies
  for(let i=enemies.length-1;i>=0;i--) {
    let e = enemies[i];
    if(e.hp<=0) { enemies.splice(i,1); continue; }
    if(e.ai==='chase') {
      let ex = e.x, ey = e.y;
      let dx = player.x-ex, dy = player.y-ey;
      let len = Math.hypot(dx,dy);
      if(len>1) {
        dx/=len; dy/=len;
        let nx = ex+dx*ENEMY_SPEED, ny = ey+dy*ENEMY_SPEED;
        if(!isWall(nx,ny,e.r)) { e.x=nx; e.y=ny; }
      }
      // Attack
      if(dist(e,player)<e.r+player.r) {
        if(!e.cd) {
          player.hp-=e.atk;
          e.cd=30;
          msgDiv.textContent = `적의 공격! HP -${e.atk}`;
          if(player.hp<=0) { running=false; gameOver=true; msgDiv.textContent='Game Over!'; }
        }
      }
      if(e.cd) e.cd--;
    }
    if(e.ai==='ranged') {
      let dx = player.x-e.x, dy = player.y-e.y;
      let len = Math.hypot(dx,dy);
      if(len>1) {
        dx/=len; dy/=len;
        if(len>200 && !isWall(e.x+dx*ENEMY_SPEED,e.y+dy*ENEMY_SPEED,e.r)) {
          e.x+=dx*ENEMY_SPEED; e.y+=dy*ENEMY_SPEED;
        }
      }
      // Shoot
      if(len<300 && !e.cd) {
        projectiles.push({x:e.x, y:e.y, dx:dx/len*5, dy:dy/len*5, color:'#fa0', from:'enemy'});
        e.cd=60;
      }
      if(e.cd) e.cd--;
    }
  }
  // Projectiles
  for(let i=projectiles.length-1;i>=0;i--) {
    let p=projectiles[i];
    p.x+=p.dx; p.y+=p.dy;
    // Hit player
    if(p.from==='enemy' && dist(p,player)<player.r+7) {
      player.hp-=5;
      msgDiv.textContent = '원거리 공격! HP -5';
      projectiles.splice(i,1);
      if(player.hp<=0) { running=false; gameOver=true; msgDiv.textContent='Game Over!'; }
      continue;
    }
    // Out of bounds
    if(p.x<0||p.y<0||p.x>MAP_W*TILE||p.y>MAP_H*TILE) projectiles.splice(i,1);
  }
  // Win
  if(enemies.length===0) {
    running=false; gameOver=true; msgDiv.textContent='Victory!';
  }
}

function isWall(x, y, r) {
  let cx = Math.floor(x/TILE), cy = Math.floor(y/TILE);
  if(cx<0||cy<0||cx>=MAP_W||cy>=MAP_H) return true;
  if(map[cy][cx]===1) return true;
  // Collision with wall boundary
  let px = x%TILE, py = y%TILE;
  if(px<r||py<r||px>TILE-r||py>TILE-r) return map[cy][cx]===1;
  return false;
}

function dist(a,b) {
  return Math.hypot(a.x-b.x,a.y-b.y);
}

function gameLoop() {
  if(running) {
    update();
    draw();
    requestAnimationFrame(gameLoop);
  } else if(gameOver) {
    draw();
  }
}

window.addEventListener('keydown', e => { keys[e.key]=true; });
window.addEventListener('keyup', e => { keys[e.key]=false; });

startBtn.onclick = () => {
  resetGame();
  gameLoop();
};

draw();
