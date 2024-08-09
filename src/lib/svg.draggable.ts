import { Box, Element, G, Point, extend, off, on } from '@svgdotjs/svg.js';

// Type-improved fork of https://github.com/svgdotjs/svg.draggable.js/blob/dee6fa732e267ff7382916e38b62b4352d31eb95/src/svg.draggable.js

const getCoordsFromEvent = (ev: TouchEvent | Event) => {
  let e: Touch | MouseEvent;
  if ('changedTouches' in ev && ev.changedTouches) {
    e = ev.changedTouches[0];
  } else {
    e = ev as MouseEvent;
  }
  return { x: e.clientX, y: e.clientY };
};

// Creates handler, saves it
class DragHandler {
  el: Element;
  box: Box = new Box();
  lastClick: Point = new Point();

  constructor(el: Element) {
    el.remember('_draggable', this);
    this.el = el;

    this.drag = this.drag.bind(this);
    this.startDrag = this.startDrag.bind(this);
    this.endDrag = this.endDrag.bind(this);
  }

  // Enables or disabled drag based on input
  init(
    enabled: boolean,
    onDrag: (ev: Event) => void = () => {},
    onEnd: (ev: Event) => void = () => {}
  ) {
    if (enabled) {
      this.el.on('mousedown.drag', (ev) => {
        this.startDrag(ev as DragEvent, onEnd);
        onDrag?.(ev);
      });
      this.el.on(
        'touchstart.drag',
        (ev) => {
          this.startDrag(ev as DragEvent, onEnd);
          onDrag?.(ev);
        },
        {
          passive: false,
        }
      );
    } else {
      this.el.off('mousedown.drag');
      this.el.off('touchstart.drag');
    }
  }

  // Start dragging
  startDrag(ev: DragEvent, onEnd: (ev: Event) => void = () => {}) {
    const isMouse = !ev.type.indexOf('mouse');

    // Check for left button
    if (isMouse && ev.which !== 1 && ev.buttons !== 0) {
      return;
    }

    // Fire beforedrag event
    if (
      this.el.dispatch('beforedrag', { event: ev, handler: this })
        .defaultPrevented
    ) {
      return;
    }

    // Prevent browser drag behavior as soon as possible
    ev.preventDefault();

    // Prevent propagation to a parent that might also have dragging enabled
    ev.stopPropagation();

    // Make sure that start events are unbound so that one element
    // is only dragged by one input only
    this.init(false);

    this.box = this.el.bbox();
    this.lastClick = this.el.point(getCoordsFromEvent(ev));

    const eventMove = (isMouse ? 'mousemove' : 'touchmove') + '.drag';
    const eventEnd = (isMouse ? 'mouseup' : 'touchend') + '.drag';

    // Bind drag and end events to window
    on(window, eventMove, this.drag as EventListener, this, { passive: false });
    on(
      window,
      eventEnd,
      (ev) => {
        this.endDrag(ev, onEnd);
      },
      this,
      {
        passive: false,
      }
    );

    // Fire dragstart event
    this.el.fire('dragstart', { event: ev, handler: this, box: this.box });
  }

  // While dragging
  drag(ev: Event) {
    const { box, lastClick } = this;

    const currentClick = this.el.point(getCoordsFromEvent(ev));
    const dx = currentClick.x - lastClick.x;
    const dy = currentClick.y - lastClick.y;

    if (!dx && !dy) return box;

    const x = box.x + dx;
    const y = box.y + dy;
    this.box = new Box(x, y, box.w, box.h);
    this.lastClick = currentClick;

    if (
      this.el.dispatch('dragmove', {
        event: ev,
        handler: this,
        box: this.box,
      }).defaultPrevented
    ) {
      return;
    }

    this.move(x, y);
  }

  move(x: number, y: number) {
    // Svg elements bbox depends on their content even though they have
    // x, y, width and height - strange!
    // Thats why we handle them the same as groups
    if (this.el.type === 'svg') {
      G.prototype.move.call(this.el, x, y);
    } else {
      this.el.move(x, y);
    }
  }

  endDrag(ev: Event, onEnd: (ev: Event) => void = () => {}) {
    // final drag
    this.drag(ev);

    // fire dragend event
    this.el.fire('dragend', { event: ev, handler: this, box: this.box });

    onEnd(ev);

    // unbind events
    off(window, 'mousemove.drag');
    off(window, 'touchmove.drag');
    off(window, 'mouseup.drag');
    off(window, 'touchend.drag');

    // Rebind initial Events
    this.init(true, () => {}, onEnd);
  }
}

extend(Element, {
  draggable(
    this: Element,
    enable = true,
    {
      onDrag = () => {},
      onEnd = () => {},
    }: { onDrag?: (ev: Event) => void; onEnd?: (ev: Event) => void }
  ) {
    const dragHandler = this.remember('_draggable') || new DragHandler(this);
    dragHandler.init(enable, onDrag, onEnd);
    return this;
  },
});
