import "./jsdom-polyfill";
import { describe, expect, beforeEach, afterEach, test, vi } from "vitest";
import { shallowMount } from "@vue/test-utils";
import Plotly from "@/components/Plotly.vue";
import plotlyjs from "plotly.js-dist-min";

const resize = {}

let wrapper;
let vm;
let layout;
let data;
let attrs;
const id = "id";

const events = [
  "AfterExport",
  "AfterPlot",
  "Animated",
  "AnimatingFrame",
  "AnimationInterrupted",
  "AutoSize",
  "BeforeExport",
  "ButtonClicked",
  "Click",
  "ClickAnnotation",
  "Deselect",
  "DoubleClick",
  "Framework",
  "Hover",
  "LegendClick",
  "LegendDoubleClick",
  "Relayout",
  "Restyle",
  "Redraw",
  "Selected",
  "Selecting",
  "SliderChange",
  "SliderEnd",
  "SliderStart",
  "Transitioning",
  "TransitionInterrupted",
  "Unhover"
];

const methods = [
  "restyle",
  "relayout",
  "update",
  "addTraces",
  "deleteTraces",
  "moveTraces",
  "extendTraces",
  "prependTraces",
  "purge"
];

async function doubleTick() {
  await vm.$nextTick()
  await vm.$nextTick()
}

function shallowMountPlotty() {
  return shallowMount(Plotly, {
    propsData: {
      layout,
      data,
      id
    },
    attrs,
    attachTo: document.body
  });
}

describe("Plotly.vue", () => {
  beforeEach(() => {
    layout = {};
    data = [];
    attrs = {
      "display-mode-bar": true
    };
    wrapper = shallowMountPlotty();
    vm = wrapper.vm;
  });

  test("defines props", () => {
    const props = {
      data: Array,
      layout: Object,
      id: {
        type: String,
        required: false,
        default: null
      }
    };
    expect(Plotly.props).toEqual(props);
  });

  test("renders a div with a SVG", () => {
    expect(wrapper.html()).toMatch(/<div.*<svg .*/sm);
  });

  test("sets id on div", () => {
    expect(wrapper.attributes("id")).toBe(id);
  });

  test("calls plotly newPlot", () => {
    const spy = vi.spyOn(plotlyjs, "newPlot");
    data = [{ x: [1, 2, 3], y: [2, 1, 2] }];
    layout = { foo: "bar" };
    shallowMountPlotty();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ tagName: 'DIV', id }),
      data,
      expect.objectContaining({ foo: "bar" }),
      {
        displayModeBar: true,
        responsive: false
      }
    );
  });

  test("allows responsive to be overridden attribute", () => {
    const spy = vi.spyOn(plotlyjs, "newPlot");
    attrs = { responsive: true };
    shallowMountPlotty();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ tagName: 'DIV', id }),
      data,
      expect.objectContaining(layout),
      {
        responsive: true
      }
    );
  });

  describe("Plotly.vue responsiveness", () => {
    let resizeCallback;
    (window as any).ResizeObserver = class ResizeObserver {
      constructor(cb) { resizeCallback = cb }
      observe(el, ...args) { }
    };

    test("call plotly resize when resized", () => {
      const spy = vi.spyOn(plotlyjs.Plots, "resize");
      shallowMountPlotty();
      expect(spy).toHaveBeenCalledTimes(0);
      resizeCallback({/* dummy entries */});
      expect(spy).toHaveBeenCalledTimes(1);
    });

    test("call plotly resize debounces", () => {
      const spy = vi.spyOn(plotlyjs.Plots, "resize");
      vi.useFakeTimers();
      shallowMountPlotty();
      resizeCallback({/* dummy entries */});
      expect(spy).toHaveBeenCalledTimes(1);
      resizeCallback({/* dummy entries */}); // Will Debounce
      expect(spy).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(100)
      expect(spy).toHaveBeenCalledTimes(2);
      vi.advanceTimersByTime(100)
      resizeCallback({/* dummy entries */}); // Will NOT Debounce
      expect(spy).toHaveBeenCalledTimes(3);
    });
  });

  test.each(events)("listens to plotly event %s and transform it in a vue event", evt => {
    const eventName = `plotly_${evt.toLowerCase()}`;
    if (evt !== "AfterPlot") {
      expect(wrapper.emitted()[eventName]).toBeUndefined();
      vm.plotlyRoot.emit(eventName);
    }
    expect(wrapper.emitted()[eventName]).toBeTruthy();
    expect(wrapper.emitted()[eventName].length).toBe(1);
  });

  test.each(methods)("defines plotly method %s", origName => {
    const methodName = `plotly${origName[0].toUpperCase()+origName.substring(1)}`;
    expect(vm[methodName]).toBeInstanceOf(Function);
    const spy = vi.spyOn(plotlyjs, origName);
    const plotlyRoot = expect.objectContaining({ tagName: 'DIV', id });
    const parameters = [1, 2, 3];
    try {
      vm[methodName](...parameters);
    } catch(err) {
      // `Ignoring bad args to "plotly.${origName}()".`
    }
    expect(spy).toHaveBeenCalledWith(plotlyRoot, 1, 2, 3);
  });

  describe.each([
    ["data", wrapper => wrapper.setProps({ data: [{ data: "novo" }] })],
    ["attr", wrapper => wrapper.setProps({ displayModeBar: "hover" })]
  ])("when %s changes", (_, changeData) => {
    describe.each([
      ["once", changeData],
      ["twice", wrapper => { changeData(wrapper); changeData(wrapper) }]
    ])("%s in the same tick", (_, update) => {
      test("calls plotly react after double tick", async () => {
        const spy = vi.spyOn(plotlyjs, "react");
        update(wrapper);
        await doubleTick();
        expect(spy).toHaveBeenCalledTimes(1);
      });

      test("does not calls plotly relayout", async () => {
        const spy = vi.spyOn(plotlyjs, "relayout");
        update(wrapper);
        await doubleTick();
        expect(spy).not.toHaveBeenCalled();
      });
    });
  });

  describe("when attrs changes to same value", () => {
    test.each(["react", "relayout"])("does not calls plotly %s", async (method) => {
      const spy = vi.spyOn(plotlyjs, method);
      wrapper.setProps(Object.assign({}, vm.$attrs));
      await doubleTick();
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe("when layout changes", () => {
    const updateLayout = () => wrapper.setProps({ layout: { novo: "layout" } });
    describe.each([
      ["once", updateLayout],
      ["twice", ()=> { updateLayout(); updateLayout() }]
    ])("%s in the same tick", (_, update) => {
      test("calls plotly relayout once", async () => {
        const spy = vi.spyOn(plotlyjs, "relayout");
        update();
        await doubleTick();
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy).toHaveBeenCalledWith(vm.$el, { novo: "layout" });
      });

      test("does not calls plotly react", async () => {
        const spy = vi.spyOn(plotlyjs, "react");
        update();
        await doubleTick();
        expect(spy).not.toHaveBeenCalled();
      });
    });
  });

  const changeData = () => wrapper.setProps({ data: [{ novo: "data" }] });
  const changeLayout = () => wrapper.setProps({ layout: { novo: "layout" } });

  describe.each([
    ()=> { changeData(); changeLayout() },
    ()=> { changeLayout(); changeData() }
  ])("when layout changes and data changes", changes => {
    test("calls plotly react once", async () => {
      const spy = vi.spyOn(plotlyjs, "react");
      changes();
      await doubleTick();
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(
        vm.$el,
        [{ novo: "data" }],
        expect.objectContaining({ novo: "layout" }),
        {
          displayModeBar: true,
          responsive: false
        }
      );
    });

    test("does not calls plotly relayout", async () => {
      const spy = vi.spyOn(plotlyjs, "relayout");
      changes();
      await doubleTick();
      expect(spy).not.toHaveBeenCalled();
    });
  });

  /*
  describe("when calling toImage", () => {
    beforeEach(() => {
      vm.toImage({ option: 1 });
    });

    test("calls Plotly toImage", () => {
      const { clientWidth: width, clientHeight: height } = vm.$el;
      expect(plotlyjs.toImage).toHaveBeenCalledWith(vm.$el, {
        width,
        height,
        option: 1,
        format: "png"
      });
    });
  });

  describe("when calling downloadImage", () => {
    beforeEach(() => {
      vm.downloadImage({ option: 1 });
    });

    test("calls Plotly toImage", () => {
      const { clientWidth: width, clientHeight: height } = vm.$el;
      const { downloadImage } = plotlyjs;
      expect(downloadImage).toHaveBeenCalled();
      const {
        mock: {
          calls: [call]
        }
      } = downloadImage;

      expect(call.length).toBe(2);
      expect(call[0]).toBe(vm.$el);
      expect(call[1]).toMatchObject({
        width,
        height,
        option: 1,
        format: "png"
      });
      expect(call[1].filename).not.toBeUndefined();
    });
  });

  describe("when destroyed", () => {
    beforeEach(() => {
      wrapper.destroy();
    });

    test("calls plotly purge", () => {
      expect(plotlyjs.purge).toHaveBeenCalledWith(vm.$el);
    });

    test.each(events)("unlistens to plotly event %s", evtName => {
      const { removeAllListeners } = vm.$el;
      expect(removeAllListeners).toHaveBeenCalledWith(`plotly_${evtName.toLowerCase()}`);
    });

    test(`unlistens to all the ${events.length} plotly events`, () => {
      const {
        removeAllListeners: {
          mock: { calls }
        }
      } = vm.$el;
      expect(calls.length).toBe(events.length);
    });
  });
*/
});
