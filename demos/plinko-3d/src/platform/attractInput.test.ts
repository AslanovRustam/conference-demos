import { createAttractInput } from './attractInput';

function rig() {
  let mode: 'play' | 'attract' = 'attract';
  let now = 0;
  const log: string[] = [];
  const input = createAttractInput({
    isAttract: () => mode === 'attract',
    exit: () => {
      mode = 'play';
      log.push('exit');
    },
    poke: () => log.push('poke'),
    now: () => now,
  });
  const ev = () => {
    const e = { stopped: false, prevented: false, stopPropagation() { this.stopped = true; }, preventDefault() { this.prevented = true; } };
    return e;
  };
  return { input, ev, log, setNow: (t: number) => (now = t), setMode: (m: 'play' | 'attract') => (mode = m) };
}

test('first tap in attract exits and is swallowed together with its click', () => {
  const { input, ev, log } = rig();
  const down = ev();
  input.onPointerDown(down);
  expect(log).toEqual(['poke', 'exit']);
  expect(down.stopped).toBe(true);
  const click = ev();
  input.onClick(click);
  expect(click.stopped).toBe(true);
  const next = ev();
  input.onClick(next);
  expect(next.stopped).toBe(false);
});

test('a drag that produced no click does not eat the next real click', () => {
  const { input, ev, setNow } = rig();
  input.onPointerDown(ev()); // выход из attract свайпом: click не пришёл
  setNow(1000);
  input.onPointerDown(ev()); // следующее настоящее нажатие
  const click = ev();
  input.onClick(click);
  expect(click.stopped).toBe(false);
});

test('a late click after the exit tap is not swallowed', () => {
  const { input, ev, setNow } = rig();
  input.onPointerDown(ev());
  setNow(600);
  const click = ev();
  input.onClick(click);
  expect(click.stopped).toBe(false);
});

test('in play mode input only pokes the idle timer', () => {
  const { input, ev, log, setMode } = rig();
  setMode('play');
  const down = ev();
  input.onPointerDown(down);
  input.onKeyDown(ev());
  expect(log).toEqual(['poke', 'poke']);
  expect(down.stopped).toBe(false);
});

test('returning to a visible page pokes the idle timer', () => {
  const { input, log } = rig();
  input.onVisible('visible');
  input.onVisible('hidden');
  expect(log).toEqual(['poke']);
});
