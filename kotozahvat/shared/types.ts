/** Формат уровня: его отдаёт сервер и лежит демо в client/public/demo/demo.json */
export type ElementType = 'heading' | 'text' | 'image' | 'button' | 'block';

export interface LevelElement {
  id: number;
  type: ElementType;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LevelData {
  width: number;
  height: number;
  /** Цвет фона страницы (необязательно) */
  background?: string;
  /** Элементы в порядке отрисовки: позже в списке — выше по слоям */
  elements: LevelElement[];
}
