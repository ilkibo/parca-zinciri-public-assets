// Each in-page screen participates in browser/WebView back and forward history.
export function createScreenHistory({key, initial, navigate, win = window}) {
  let current = initial, index = 0, restoring = false, disposed = false;
  const previous = win.history.state?.[key];
  if (previous && Number.isSafeInteger(previous.index)) index = previous.index;
  function state(route, i) {return {...win.history.state, [key]:{route,index:i}};}
  win.history.replaceState(state(initial,index), '');
  async function pop(event) {
    const entry = event.state?.[key];
    if (disposed || !entry || !Number.isSafeInteger(entry.index)) return;
    if (JSON.stringify(entry.route) === JSON.stringify(current)) {index=entry.index;return;}
    const oldIndex=index;
    restoring=true;
    try {
      const accepted=await navigate(entry.route);
      if (accepted === false) {win.history.go(oldIndex-entry.index);return;}
      current=entry.route;index=entry.index;
    } finally {restoring=false;}
  }
  win.addEventListener('popstate',pop);
  return {
    record(route) {
      if (disposed || restoring || JSON.stringify(route)===JSON.stringify(current)) return;
      current=route;index++;win.history.pushState(state(route,index),'');
    },
    back(fallback) {if(index>0)win.history.back();else fallback?.();},
    dispose() {disposed=true;win.removeEventListener('popstate',pop);}
  };
}
