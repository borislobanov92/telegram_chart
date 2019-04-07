type BackgroundColors = {
  day: string;
  night: string;
};

type Subscriber = (isNightMode: boolean) => void;

class NightModeButton {

  element: HTMLElement;
  isNightMode: boolean;
  subscibers: Array<Subscriber>;
  backgroundColors: BackgroundColors = {
    day: '#fff',
    night: '#242F3E'
  };

  constructor(element: HTMLElement, isNightMode: boolean) {
    this.element = element;
    this.isNightMode = isNightMode;

    this.subscibers = [];

    this.element.addEventListener('click', this.clickListener);
  }

  clickListener = () => {
    this.isNightMode = !this.isNightMode;
    this.element.textContent = `Switch to ${this.isNightMode ? 'Day' : 'Night'} mode`;
    document.body.classList.toggle('night-mode_is-on');
    document.body.style.backgroundColor = this.isNightMode ? this.backgroundColors.night : this.backgroundColors.day;
    this.element.style.backgroundColor = this.isNightMode ? this.backgroundColors.night : this.backgroundColors.day;

    this.subscibers.forEach((callback) => callback(this.isNightMode));
  }

  subscribe(callback: Subscriber) {
    this.subscibers.push(callback);
  }
}

export default NightModeButton;
