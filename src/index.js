import NumberView from './components/number-view';
import SingleKeyboard from './components/single-keyboard';
import MixedKeyboard from './components/mixed-keyboard';

const components = [NumberView, SingleKeyboard, MixedKeyboard];

const install = function(Vue, opts = {}) {
  if (install.installed) return;
  components.map(component => {
    Vue.component(component.name, component);
  });
};

if (typeof window !== 'undefined' && window.Vue) {
  install(window.Vue);
}

export default install;
export { install, NumberView, SingleKeyboard, MixedKeyboard };
