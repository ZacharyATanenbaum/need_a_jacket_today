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

function app({permission='prompt',stored={},fetch,permissions=true,weatherFails=false,live=false}={}){
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
    window:{location:{search:weatherFails||live?'':'?demo=short'},isSecureContext:true},
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
  const fallbackTimeout=page.timers.find(timer=>timer.delay===12000&&!timer.cleared);
  assert.ok(fallbackTimeout);fallbackTimeout.callback();await settle();
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

const epoch=Math.floor(Date.now()/3600000)*3600;
const fallbackWeather=()=>({timezone:'America/New_York',current:{time:epoch+900,temperature_2m:60,apparent_temperature:58,weather_code:3,wind_speed_10m:8,precipitation:0},hourly:{time:Array.from({length:48},(_,i)=>epoch+(i-12)*3600),temperature_2m:Array(48).fill(60),apparent_temperature:Array(48).fill(58),precipitation_probability:Array(48).fill(20),weather_code:Array(48).fill(3),wind_speed_10m:Array(48).fill(8)}});
const throttled=()=>({ok:false,status:401,json:async()=>{throw new Error('API key is throttled')}});

test('throttled Weather Underground falls back to live weather with correct units, hours and attribution',async()=>{
  const calls=[];
  const page=app({live:true,fetch:async url=>{
    calls.push(url);
    return url.hostname==='api.weather.com'?throttled():response(fallbackWeather());
  }});await settle();
  assert.equal(page.get('temperature').textContent,'60°');
  assert.match(page.get('updated').textContent,/Live weather · Open-Meteo/);
  const url=calls.find(url=>url.hostname==='api.open-meteo.com');
  for(const [key,value] of Object.entries({temperature_unit:'fahrenheit',wind_speed_unit:'mph',precipitation_unit:'inch',timeformat:'unixtime'}))assert.equal(url.searchParams.get(key),value);
  const data=JSON.parse(page.storage.get('naj.weatherCache.wu')).data;
  assert.equal(data.hourly.length,24);
  assert.equal(data.hourly[0].time,new Date(epoch*1000).toISOString());
  assert.equal(data.current.feelsLike,58);
  assert.equal(page.positions.length,0);
});

test('successful Weather Underground requests do not use fallback',async()=>{
  const calls=[];
  const page=app({live:true,fetch:async url=>{
    calls.push(url);
    return response(url.pathname.includes('observations')?{temperature:65}: {validTimeLocal:[new Date().toISOString()],temperature:[65]});
  }});await settle();
  assert.equal(page.get('temperature').textContent,'65°');
  assert.equal(calls.length,2);
  assert.ok(calls.every(url=>url.hostname==='api.weather.com'));
});

test('city search survives shared-key throttling',async()=>{
  const page=app({fetch:async url=>url.hostname==='api.weather.com'?throttled():response({results:[{name:'London',latitude:51.5,longitude:-0.12,country_code:'GB',country:'United Kingdom'}]})});
  await settle();await page.search('London');
  assert.match(page.get('searchResults').innerHTML,/London/);
});

test('incomplete fallback data is rejected instead of displaying invalid weather',async()=>{
  const page=app({live:true,fetch:async url=>url.hostname==='api.weather.com'?throttled():response({current:{temperature_2m:null}})});
  await settle();
  assert.equal(page.get('condition').textContent,'Could not load weather');
  assert.equal(page.storage.get('naj.weatherCache.wu'),undefined);
});

test('both providers failing preserves a recent saved forecast',async()=>{
  const stored={'naj.weatherCache.wu':JSON.stringify({location:{latitude:40.7128,longitude:-74.006},savedAt:Date.now(),data:{provider:'Open-Meteo',current:{temperature:60,feelsLike:58},hourly:Array.from({length:24},(_,i)=>({time:new Date((epoch+i*3600)*1000).toISOString(),temperature:60,feelsLike:58}))}})};
  const page=app({live:true,stored,fetch:async()=>{throw new Error('offline')}});await settle();
  assert.equal(page.get('temperature').textContent,'60°');
  assert.match(page.get('updated').textContent,/Saved forecast/);
});
