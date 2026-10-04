import confetti from "canvas-confetti";
import { color, createCanvasGame, drawLabel, gameInput, loadImage, pointChunks, rand, runLoop, tinted, type Area } from "./canvasGame";
import { confettiStyle, fadeOutLayer, hintBubble, onStop, type CelebrationOptions, type GameOptions } from "./shared";
import { playSound } from "./sounds";

// Pong, held upright: your paddle at the bottom, the computer's at the top.
// Drag anywhere to move yours — it moves with your finger from wherever it
// is (so the finger never covers it); a mouse just steers it, and the arrow
// keys nudge it. Where the ball meets the paddle sets the angle it goes back
// at, and every hit speeds it up a little.
const BALL_SRC = "/anims/orb-pearl.webp";
const PADDLE_SRC = "/anims/platform.webp"; // the block stack's platform
const PADDLE_ASPECT = 73 / 480;

const TUNE = {
  serveSpeed: 0.5, // × screen height per second
  speedUp: 1.06, // per paddle hit
  maxSpeed: 1.5, // × screen height per second
  maxAngle: (60 * Math.PI) / 180, // off the very edge of the paddle
  aiSpeed: 0.7, // the computer's paddle, × screen width per second…
  aiSpeedUp: 0.04, // …plus this much per point you've won
  aiMaxSpeed: 1.4,
  aiAim: 0.65, // how far off it can aim, × paddle width (so it sometimes misses)
  aiWakes: 0.55, // it starts chasing once the ball is this far up the court
};

type Art = { ball: HTMLImageElement | null; you: HTMLImageElement | null; them: HTMLCanvasElement | HTMLImageElement | null };

async function loadArt(): Promise<Art> {
  const [ball, paddle] = await Promise.all([loadImage(BALL_SRC), loadImage(PADDLE_SRC)]);
  return { ball, you: paddle, them: paddle ? tinted(paddle, "hue-rotate(180deg)") : null };
}

const sparkle = (x: number, y: number) =>
  confetti({
    ...confettiStyle(),
    particleCount: 22,
    spread: 360,
    startVelocity: 14,
    ticks: 55,
    origin: { x: x / window.innerWidth, y: y / window.innerHeight },
  });

// The shared machinery for the celebration and the game.
function createPong(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  court: Area,
  events: {
    onHit: () => void; // you returned it
    onWin: (x: number, y: number) => void; // got past the computer
    onMiss: () => void; // got past you
  },
  opts: { aiNeverMisses?: boolean } = {},
) {
  let art: Art = { ball: null, you: null, them: null };
  void loadArt().then((a) => (art = a));
  const padW = Math.min(court.w * 0.32, 130);
  const padH = Math.max(14, padW * PADDLE_ASPECT);
  const r = Math.max(10, Math.min(court.w, court.h) * 0.03); // ball radius
  const youY = court.y + court.h - padH / 2; // paddle centers
  const themY = court.y + padH / 2;
  const clampX = (x: number) => Math.max(court.x + padW / 2, Math.min(court.x + court.w - padW / 2, x));

  let you = court.x + court.w / 2;
  let them = you;
  let ball = { x: you, y: court.y + court.h / 2, vx: 0, vy: 0 };
  let speed = 0;
  let waiting = 0.6; // seconds until the next serve
  let towardYou = true;
  let aiError = 0; // how far off the computer aims this rally
  let wins = 0;

  const serve = () => {
    speed = TUNE.serveSpeed * H;
    const a = rand(-0.35, 0.35);
    ball = { x: court.x + court.w / 2, y: court.y + court.h / 2, vx: Math.sin(a) * speed, vy: Math.cos(a) * speed * (towardYou ? 1 : -1) };
    aiError = rand(-TUNE.aiAim, TUNE.aiAim) * padW;
  };

  // Bounces off a paddle: the angle depends on where it hit.
  const bounce = (paddleX: number, up: boolean) => {
    const off = Math.max(-1, Math.min(1, (ball.x - paddleX) / (padW / 2 + r)));
    speed = Math.min(TUNE.maxSpeed * H, speed * TUNE.speedUp);
    const a = off * TUNE.maxAngle;
    ball.vx = Math.sin(a) * speed;
    ball.vy = Math.cos(a) * speed * (up ? -1 : 1);
    void playSound("thud");
  };

  const step = (dt: number) => {
    if (waiting > 0) {
      waiting -= dt;
      if (waiting <= 0) serve();
      return;
    }
    // The computer heads for where the ball will cross its line (off by a
    // little each rally); a bit faster for every point you've won.
    // (In the celebration it's quick enough never to miss.)
    const aiMax = (opts.aiNeverMisses ? 4 : Math.min(TUNE.aiMaxSpeed, TUNE.aiSpeed + TUNE.aiSpeedUp * wins)) * W * dt;
    const chasing = ball.vy < 0 && (opts.aiNeverMisses || ball.y < court.y + court.h * TUNE.aiWakes);
    const goal = chasing ? predictX(themY) + (opts.aiNeverMisses ? 0 : aiError) : ball.vy < 0 ? them : court.x + court.w / 2;
    them = clampX(them + Math.max(-aiMax, Math.min(aiMax, goal - them)));

    // Move in small steps so a fast ball can't skip through a paddle.
    const n = Math.ceil((Math.hypot(ball.vx, ball.vy) * dt) / (r * 0.8)) || 1;
    for (let i = 0; i < n; i++) {
      ball.x += (ball.vx * dt) / n;
      ball.y += (ball.vy * dt) / n;
      if (ball.x < court.x + r) {
        ball.x = court.x + r;
        ball.vx = Math.abs(ball.vx);
      } else if (ball.x > court.x + court.w - r) {
        ball.x = court.x + court.w - r;
        ball.vx = -Math.abs(ball.vx);
      }
      if (ball.vy > 0 && ball.y + r >= youY - padH / 2 && ball.y < youY && Math.abs(ball.x - you) <= padW / 2 + r) {
        ball.y = youY - padH / 2 - r;
        bounce(you, true);
        aiError = rand(-TUNE.aiAim, TUNE.aiAim) * padW;
        events.onHit();
      } else if (ball.vy < 0 && ball.y - r <= themY + padH / 2 && ball.y > themY && Math.abs(ball.x - them) <= padW / 2 + r) {
        ball.y = themY + padH / 2 + r;
        bounce(them, false);
      }
      if (ball.y > court.y + court.h + r * 2) {
        towardYou = true;
        waiting = 1;
        void playSound("whoops");
        events.onMiss();
        return;
      }
      if (ball.y < court.y - r * 2) {
        wins++;
        towardYou = false;
        waiting = 0.8;
        void playSound("powerUp");
        events.onWin(ball.x, court.y + r);
        return;
      }
    }
  };

  // Where the ball will be across when it reaches `y` (bouncing off the
  // side walls on the way).
  const predictX = (y: number) => {
    if (!ball.vy) return ball.x;
    const t = (y - ball.y) / ball.vy;
    if (t < 0) return ball.x;
    const lo = court.x + r;
    const span = court.w - 2 * r;
    let x = ball.x + ball.vx * t - lo;
    x = ((x % (2 * span)) + 2 * span) % (2 * span);
    return lo + (x > span ? 2 * span - x : x);
  };

  const drawPaddle = (img: Art["you"] | Art["them"], x: number, y: number, tone: string) => {
    if (img) ctx.drawImage(img, x - padW / 2, y - padH / 2, padW, padH);
    else {
      ctx.fillStyle = color(tone);
      ctx.beginPath();
      ctx.roundRect(x - padW / 2, y - padH / 2, padW, padH, padH / 2);
      ctx.fill();
    }
  };

  const draw = (label?: number) => {
    ctx.clearRect(0, 0, W, H);
    // The court: a soft panel with a dashed half-way line.
    ctx.fillStyle = color("primary", 0.06);
    ctx.beginPath();
    ctx.roundRect(court.x - 6, court.y - 6, court.w + 12, court.h + 12, 18);
    ctx.fill();
    ctx.strokeStyle = color("primary", 0.25);
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 12]);
    ctx.beginPath();
    ctx.moveTo(court.x + 10, court.y + court.h / 2);
    ctx.lineTo(court.x + court.w - 10, court.y + court.h / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    drawPaddle(art.them, them, themY, "party-cyan");
    drawPaddle(art.you, you, youY, "accent");
    if (waiting <= 0 || speed > 0) {
      if (art.ball) ctx.drawImage(art.ball, ball.x - r * 1.15, ball.y - r * 1.15, r * 2.3, r * 2.3);
      else {
        ctx.fillStyle = color("party-yellow");
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      if (label) drawLabel(ctx, `+${label}`, ball.x, ball.y - r * 2.2, 16);
    }
  };

  // Steering. A finger moves the paddle by however far it moves (from
  // wherever the paddle is); a mouse just puts it where the pointer is.
  let grab: { finger: number; paddle: number } | null = null;
  const input = gameInput({
    down: (x) => (grab = { finger: x, paddle: you }),
    move: (x, _y, pressed) => {
      if (pressed && grab) you = clampX(grab.paddle + (x - grab.finger));
      else if (!pressed) you = clampX(x);
    },
    up: () => (grab = null),
    key: (dir) => {
      if (dir === "left") you = clampX(you - padW * 0.5);
      if (dir === "right") you = clampX(you + padW * 0.5);
    },
  });

  return { step, draw, stop: input };
}

// Celebration: the ball carries "+N" — hit it back to collect it. The
// computer always returns it, and a miss just serves it again. Nothing
// moves until the kid touches the screen.
export async function playPong(opts: CelebrationOptions): Promise<void> {
  const { layer, ctx, W, H, area } = createCanvasGame("celebration");
  const waiting = [...pointChunks(opts.points ?? 0)];
  let revealed = false;
  let faded = false;
  let touched = false;
  const hint = hintBubble(layer, "Drag to hit the ball back!", area.y + area.h / 2 - 60);
  const court = { x: area.x + 8, y: area.y + 60, w: area.w - 16, h: area.h - 120 };
  const pong = createPong(
    ctx,
    W,
    H,
    court,
    {
      onHit: () => {
        if (revealed || !waiting.length) return;
        waiting.shift();
        void playSound("powerUp");
        if (!waiting.length) {
          revealed = true;
          opts.onReveal?.();
          setTimeout(() => void playSound("cheer"), 150);
          void fadeOutLayer(layer, 600).then(() => (faded = true));
        }
      },
      onWin: (x, y) => sparkle(x, y),
      onMiss: () => {},
    },
    { aiNeverMisses: true },
  );
  const first = () => {
    touched = true;
    hint.remove();
    window.removeEventListener("pointerdown", first);
  };
  window.addEventListener("pointerdown", first);

  await new Promise<void>((finish) => {
    runLoop(layer, (dt) => {
      if (touched && !revealed) pong.step(dt);
      pong.draw(waiting[0]);
      if (faded) {
        finish();
        return false;
      }
    });
  });
  window.removeEventListener("pointerdown", first);
  pong.stop();
  layer.remove();
}

// "Keep playing": +1 every time the ball gets past the computer. Every
// time it gets past you costs one of three lives. The computer gets quicker
// as you win points, and the ball speeds up through each rally.
export function playPongGame(opts: GameOptions): () => void {
  const { layer, ctx, W, H, safe } = createCanvasGame("game");
  let score = 0;
  let lives = 3;
  opts.onLives?.(lives);
  let over = false;
  let touched = false;
  const hint = hintBubble(layer, "Drag anywhere to move your paddle!", safe.y + safe.h / 2 - 60);
  const court = { x: safe.x + 8, y: safe.y + 12, w: safe.w - 16, h: safe.h - 24 };
  const pong = createPong(ctx, W, H, court, {
    onHit: () => {},
    onWin: (x, y) => {
      if (over) return;
      opts.onScore(++score);
      sparkle(x, y);
    },
    onMiss: () => {
      if (over) return;
      lives -= 1;
      opts.onLives?.(lives);
      if (lives <= 0) {
        over = true;
        opts.onGameOver?.();
      } else void playSound("aww");
    },
  });
  const first = () => {
    touched = true;
    hint.remove();
    window.removeEventListener("pointerdown", first);
  };
  window.addEventListener("pointerdown", first);
  const loop = runLoop(layer, (dt) => {
    if (touched && !over) pong.step(dt);
    pong.draw();
    return !over;
  });

  const stop = () => {
    window.removeEventListener("pointerdown", first);
    loop();
    pong.stop();
    layer.remove();
  };
  onStop(stop);
  return stop;
}
