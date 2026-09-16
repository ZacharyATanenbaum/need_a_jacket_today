const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const vm=require('node:vm');

const source=readFileSync(require('node:path').join(__dirname,'../assets/app.js'),'utf8');
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done});return{promise,resolve}};
const response=data=>({ok:true,json:async()=>data});
const boston={name:'Boston, MA',latitude:42.36,longitude:-71.06};
const london={name:'London, UK',latitude:51.5,longitude:-0.12};

function app({permission='prompt',stored={},fetch,permissions=true,weatherFails=false}={}){
  const elements=new Map(),storage=new Map(Object.entries(stored)),positions=[],timers=[];
  function element(){
    const listeners={},classes=new Set();
    return{textContent:'',innerHTML:'',dataset:{},style:{setProperty(){}},disabled:false,
      classList:{add(...names){names.forEach(name=>classes.add(name))},remove(...names){names.forEach(name=>classes.delete(name))},toggle(){},contains:name=>classes.has(name)},
      setAttribute(){},focus(){},querySelectorAll(){return[]},
      addEventListener(name,callback){listeners[name]=callback},
      click(){if(!this.disabled)return listeners.click?.({target:this})},
      submit(){return listeners.submit?.({preventDefault(){}})}
    };
  }
  const get=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id)};
  const root=element();
  const navigator={geolocation:{getCurrentPosition(success,error,options){positions.push({success,error,options})}}};
  if(permissions)navigator.permissions={query:async()=>({state:permission})};
  const context={URL,URLSearchParams,AbortController,Intl,Date,Promise,console:{error(){}},navigator,
    window:{location:{search:weatherFails?'':'?demo=short'},isSecureContext:true},
    document:{getElementById:get,documentElement:root,body:element(),querySelectorAll:()=>[],addEventListener(){}},
    localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},
    Image:class{},setInterval(){},setTimeout(callback,delay){const timer={callback,delay};timers.push(timer);return timer},clearTimeout(timer){if(timer)timer.cleared=true},
    fetch:fetch|| (async()=>{if(weatherFails)throw new Error('offline');return response({location:{city:'Boston',countryCode:'US',adminDistrictCode:'MA'}})})
  };
  vm.runInNewContext(source,context);
  return{get,storage,positions,timers,root,async search(query){get('searchInput').value=query;get('searchForm').submit();await settle()}};
}

test('startup defaults to New York without requesting device location for any permission state',async()=>{
  for(const permission of ['prompt','granted','denied']){
    const page=app({permission});await settle();
    assert.equal(page.positions.length,0);
    assert.equal(page.get('locationName').textContent,'New York, NY (default)');
    assert.equal(page.get('temperature').textContent,'80°');
  }
});

test('a previous device-location choice still defaults to New York without a startup lookup',async()=>{
  const page=app({permission:'granted',stored:{'naj.locationMode':'geolocation'}});await settle();
  assert.equal(page.positions.length,0);
  assert.equal(page.get('locationName').textContent,'New York, NY (default)');
});

test('geolocation works without the optional Permissions API',async()=>{
  const page=app({permissions:false});await settle();
  assert.equal(page.positions.length,0);
  page.get('useCurrentLocationTop').click();
  assert.equal(page.positions.length,1);
});

test('saved manual choice takes priority over granted location permission',async()=>{
  const page=app({permission:'granted',stored:{'naj.locationMode':'manual','naj.manualLocation':JSON.stringify(london)}});await settle();
  assert.equal(page.get('locationName').textContent,london.name);
  assert.equal(page.positions.length,0);
});

test('manual locations at zero latitude or longitude survive reload',async()=>{
  const page=app({stored:{'naj.locationMode':'manual','naj.manualLocation':JSON.stringify({name:'Equator',latitude:0,longitude:30})}});await settle();
  assert.equal(page.get('locationName').textContent,'Equator');
});

test('explicit location fix requests a fresh accurate position and shows progress',async()=>{
  const page=app({stored:{'naj.locationMode':'manual','naj.manualLocation':JSON.stringify(london)}});await settle();
  page.get('useCurrentLocationTop').click();
  assert.equal(page.positions.at(-1).options.maximumAge,0);
  assert.equal(page.positions.at(-1).options.enableHighAccuracy,true);
  assert.equal(page.get('useCurrentLocationTop').textContent,'Finding location…');
});

test('an older geolocation result cannot overwrite a manual correction',async()=>{
  const page=app({permission:'granted'});await settle();
  page.get('useCurrentLocationTop').click();
  const pending=page.positions[0];
  await page.search('51.5,-0.12');
  pending.success({coords:boston});await settle();
  assert.equal(JSON.parse(page.storage.get('naj.weatherCache.wu')).location.latitude,51.5);
  assert.equal(page.storage.get('naj.locationMode'),'manual');
});

test('search responses arriving out of order do not replace newer results',async()=>{
  const old=deferred();
  const page=app({fetch:async url=>{
    if(url.searchParams.get('query')==='Old')return old.promise;
    return response({location:{displayName:['New'],latitude:[51.5],longitude:[-0.12]}});
  }});await settle();
  await page.search('Old');await page.search('New');
  old.resolve(response({location:{displayName:['Old'],latitude:[42.36],longitude:[-71.06]}}));await settle();
  assert.match(page.get('searchResults').innerHTML,/New/);
  assert.doesNotMatch(page.get('searchResults').innerHTML,/Old/);
});

test('manual correction is saved even if the weather provider fails',async()=>{
  const page=app({weatherFails:true});await settle();await page.search('51.5,-0.12');
  assert.equal(page.storage.get('naj.locationMode'),'manual');
  assert.equal(JSON.parse(page.storage.get('naj.manualLocation')).latitude,51.5);
});

test('invalid coordinate ranges do not request a forecast',async()=>{
  const page=app();await settle();await page.search('91,200');
  assert.match(page.get('modalStatus').textContent,/latitude.*-90.*90/i);
  assert.equal(page.storage.get('naj.manualLocation'),undefined);
});

test('denied explicit location request keeps the default and gives a recovery path',async()=>{
  const page=app();await settle();
  page.get('useCurrentLocationTop').click();
  assert.equal(page.positions.length,1);
  page.positions[0].error({code:1});await settle();
  assert.match(page.get('locationName').textContent,/\(default\)/);
  assert.match(page.get('geoStatusText').textContent,/Default/);
  assert.match(page.get('toast').textContent,/blocked.*choose a city/i);
});

test('a stalled city-name lookup times out and still loads weather at the coordinates',async()=>{
  const page=app({fetch:(_url,{signal})=>new Promise((_resolve,reject)=>{
    signal.addEventListener('abort',()=>reject(new Error('aborted')));
  })});await settle();
  page.get('useCurrentLocationTop').click();
  page.positions[0].success({coords:boston});await settle();
  const timeout=page.timers.find(timer=>timer.delay===5000&&!timer.cleared);
  assert.ok(timeout);timeout.callback();await settle();
  assert.equal(page.get('locationName').textContent,'42.360, -71.060');
  assert.equal(page.get('temperature').textContent,'80°');
  assert.equal(page.get('useCurrentLocationTop').disabled,false);
});

test('manual selection wins even if an older reverse lookup finishes later',async()=>{
  const old=deferred();
  const page=app({fetch:async url=>url.searchParams.get('geocode')==='42.36,-71.06'
    ?old.promise:response({location:{city:'London',country:'United Kingdom'}})});await settle();
  page.get('useCurrentLocationTop').click();
  page.positions[0].success({coords:boston});await settle();
  await page.search('51.5,-0.12');
  old.resolve(response({location:{city:'Boston',countryCode:'US',adminDistrictCode:'MA'}}));await settle();
  assert.equal(page.get('locationName').textContent,'London, United Kingdom');
  assert.equal(page.storage.get('naj.locationMode'),'manual');
});

test('late device-location failure cannot reset a manual selection to the default',async()=>{
  const page=app();await settle();
  page.get('useCurrentLocationTop').click();
  await page.search('51.5,-0.12');
  page.positions[0].error({code:3});await settle();
  assert.equal(page.storage.get('naj.locationMode'),'manual');
  assert.equal(JSON.parse(page.storage.get('naj.manualLocation')).latitude,51.5);
  assert.equal(page.get('toast').textContent,'');
});

test('a stalled search reports a recoverable error after its timeout',async()=>{
  const page=app({fetch:(_url,{signal})=>new Promise((_resolve,reject)=>{
    signal.addEventListener('abort',()=>reject(new Error('aborted')));
  })});await settle();await page.search('Boston');
  const timeout=page.timers.find(timer=>timer.delay===12000&&!timer.cleared);
  assert.ok(timeout);timeout.callback();await settle();
  assert.match(page.get('modalStatus').textContent,/unavailable.*Try again/);
});

test('a failed explicit fix preserves the selected city and enables retry',async()=>{
  const page=app({stored:{'naj.locationMode':'manual','naj.manualLocation':JSON.stringify(london)}});await settle();
  page.get('useCurrentLocationTop').click();
  page.positions[0].error({code:3});await settle();
  assert.equal(page.get('locationName').textContent,london.name);
  assert.equal(page.get('useCurrentLocationTop').disabled,false);
  assert.match(page.get('toast').textContent,/timed out/);
});
