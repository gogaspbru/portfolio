/**
 * Команды коту на один шаг симуляции.
 * И клавиатура с мышью, и тачи, и автопилот (поиск пути) пишут сюда —
 * кот не знает, откуда пришла команда. Через этот же слой потом пойдут
 * бот-пылесос и сетевые игроки.
 */
export interface Vec {
  x: number;
  y: number;
}

export interface Commands {
  /** -1 влево, 0 стоять, 1 вправо */
  moveX: number;
  /** Нажали прыжок (однократно) */
  jump: boolean;
  /** Прыжок удерживается (для высоты прыжка) */
  jumpHeld: boolean;
  /** Спрыгнуть сквозь платформу (однократно) */
  drop: boolean;
  /** Куда смотрит кот (мир). null — по направлению бега */
  aim: Vec | null;
  /** Удар лапой в точку (однократно) */
  paw: Vec | null;
  /** Точить когти в точке (пока не null) */
  scratch: Vec | null;
}

export function emptyCommands(): Commands {
  return { moveX: 0, jump: false, jumpHeld: false, drop: false, aim: null, paw: null, scratch: null };
}
