(()=>{"use strict";
    const HORIZON_HOURS=6;
    const DISPLAY_HOURS=24;
    const CONFIG={
      weatherCompanyProxy:window.NAJ_CONFIG?.weatherCompanyProxy||"",
      defaultLocation:{name:"New York, NY",latitude:40.7128,longitude:-74.0060},
      cacheMaxAgeMs:30*60*1000
    };
    const OTTER_ASSET_BASE="assets/generated-otters/v1/";
    const OTTER_FILES={
      dontgo:{no:"dont-go-outside.webp"},
      winter:{no:"winter-jacket-no-umbrella.webp",yes:"winter-jacket-umbrella.webp"},
      heavy:{no:"heavy-jacket-no-umbrella.webp",yes:"heavy-jacket-umbrella.webp"},
      light:{no:"light-jacket-no-umbrella.webp",yes:"light-jacket-umbrella.webp"},
      long:{no:"long-sleeve-no-umbrella.webp",yes:"long-sleeve-umbrella.webp"},
      short:{no:"short-sleeve-no-umbrella.webp",yes:"short-sleeve-umbrella.webp"},
      shirtless:{no:"shirtless-no-umbrella.webp",yes:"shirtless-umbrella.webp"}
    };
    const BACKGROUND_ASSET_BASE="generated-backgrounds/v1/";
    const AVATAR_ALT_LABELS={dontgo:"Stay inside",winter:"Winter jacket",heavy:"Heavy jacket",light:"Light jacket",long:"Long sleeve",short:"Short sleeve",shirtless:"Shirtless"};
    const BAND_COPY={
      "Don't Go Outside":{key:"dontgo",headline:"Don't go<br>outside.",title:"Don't Go Outside",desc:"Stay indoors if you can. It is dangerously cold.",icon:"🏠"},
      "Winter Jacket":{key:"winter",headline:"Winter jacket<br>kind of day.",title:"Winter Jacket",desc:"Use your warmest winter outerwear.",icon:"🧥"},
      "Heavy Jacket":{key:"heavy",headline:"Heavy jacket<br>kind of day.",title:"Heavy Jacket",desc:"A puffer or similarly warm jacket is appropriate.",icon:"🧥"},
      "Light Jacket":{key:"light",headline:"Light jacket<br>kind of day.",title:"Light Jacket",desc:"A bomber, hoodie, or other light layer should work.",icon:"🧥"},
      "Long Sleeve":{key:"long",headline:"Long sleeve<br>kind of day.",title:"Long Sleeve",desc:"Skip the jacket, but keep your arms covered.",icon:"👕"},
      "Short Sleeve":{key:"short",headline:"Short sleeve<br>kind of day.",title:"Short Sleeve",desc:"A T-shirt should be enough.",icon:"👕"},
      "Shirtless":{key:"shirtless",headline:"Shirtless<br>kind of day.",title:"Shirtless",desc:"It is hot enough for the lightest possible clothing.",icon:"☀️"}
    };
    const storageGet=key=>{try{return localStorage.getItem(key)}catch{return null}};
    const storageSet=(key,value)=>{try{localStorage.setItem(key,value)}catch{}};
    const state={unit:storageGet("naj.unit")||"fahrenheit",profile:storageGet("naj.profile")||"regular",location:{...CONFIG.defaultLocation,name:"Finding location…"},locationMode:"loading",weather:null,loading:false,dataMode:"loading",mascotToken:0};
    const $=id=>document.getElementById(id);
    const els={locationButton:$("locationButton"),locationName:$("locationName"),geoStatusText:$("geoStatusText"),locationModal:$("locationModal"),closeModal:$("closeModal"),searchForm:$("searchForm"),searchInput:$("searchInput"),searchResults:$("searchResults"),modalStatus:$("modalStatus"),useCurrentLocation:$("useCurrentLocation"),useCurrentLocationTop:$("useCurrentLocationTop"),toast:$("toast"),temperature:$("temperature"),weatherIcon:$("weatherIcon"),condition:$("condition"),highLow:$("highLow"),verdict:$("verdict"),reason:$("reason"),updated:$("updated"),hero:$("hero"),mascot:$("mascot"),mascotImage:$("mascotImage"),jacketCard:$("jacketCard"),jacketIcon:$("jacketIcon"),jacketTitle:$("jacketTitle"),jacketStatus:$("jacketStatus"),jacketDescription:$("jacketDescription"),umbrellaCard:$("umbrellaCard"),umbrellaStatus:$("umbrellaStatus"),umbrellaDescription:$("umbrellaDescription"),feelsLike:$("feelsLike"),feelsNote:$("feelsNote"),wind:$("wind"),windNote:$("windNote"),rain:$("rain"),rainNote:$("rainNote"),sixHourLow:$("sixHourLow"),trendNote:$("trendNote"),hourlyForecast:$("hourlyForecast")};
    const CODES={0:["Clear","☀️","clear"],1:["Mostly clear","🌤️","clear"],2:["Partly cloudy","⛅","cloud"],3:["Cloudy","☁️","cloud"],45:["Foggy","🌫️","cloud"],48:["Foggy","🌫️","cloud"],51:["Light drizzle","🌦️","rain"],53:["Drizzle","🌦️","rain"],55:["Heavy drizzle","🌧️","rain"],56:["Freezing drizzle","🌧️","rain"],57:["Freezing drizzle","🌧️","rain"],61:["Light rain","🌦️","rain"],63:["Rain","🌧️","rain"],65:["Heavy rain","🌧️","rain"],66:["Freezing rain","🌧️","rain"],67:["Freezing rain","🌧️","rain"],71:["Light snow","🌨️","snow"],73:["Snow","🌨️","snow"],75:["Heavy snow","❄️","snow"],77:["Snow grains","❄️","snow"],80:["Rain showers","🌦️","rain"],81:["Rain showers","🌧️","rain"],82:["Heavy showers","⛈️","storm"],85:["Snow showers","🌨️","snow"],86:["Heavy snow showers","❄️","snow"],95:["Thunderstorms","⛈️","storm"],96:["Thunderstorms","⛈️","storm"],99:["Severe thunderstorms","⛈️","storm"]};
    const safeJson=v=>{try{return v?JSON.parse(v):null}catch{return null}};
    const escapeHtml=v=>String(v??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
    const convertTemp=f=>state.unit==="fahrenheit"?f:(f-32)*5/9;
    const convertWind=m=>state.unit==="fahrenheit"?m:m*1.60934;
    const temp=v=>`${Math.round(convertTemp(v))}°`;
    const wind=v=>`${Math.round(convertWind(v))} ${state.unit==="fahrenheit"?"mph":"km/h"}`;
    const localHour=(date,zone)=>Number(new Intl.DateTimeFormat("en-US",{timeZone:zone||undefined,hour:"2-digit",hourCycle:"h23"}).format(new Date(date)));
    const formatHour=(date,zone)=>new Date(date).toLocaleTimeString([],{hour:"numeric",timeZone:zone||undefined});

    function descriptor(item){
      if(item.phrase){
        const p=item.phrase.toLowerCase();
        const type=p.includes("thunder")?"storm":p.includes("snow")?"snow":p.includes("rain")||p.includes("shower")||p.includes("drizzle")?"rain":p.includes("clear")||p.includes("sun")?"clear":"cloud";
        const icon=type==="storm"?"⛈️":type==="snow"?"❄️":type==="rain"?"🌧️":type==="clear"?"☀️":"☁️";
        const background=type==="cloud"&&(p.includes("partly")||p.includes("mostly clear"))?"partly-cloudy":type==="cloud"?"cloudy-foggy":type;
        return[item.phrase,icon,type,background];
      }
      const [phrase,icon,type]=CODES[item.weatherCode]||["Variable conditions","🌤️","cloud"];
      const background=item.weatherCode===1||item.weatherCode===2?"partly-cloudy":type==="cloud"?"cloudy-foggy":type;
      return[phrase,icon,type,background];
    }

    // Exact decision logic from ZacharyATanenbaum/need_a_jacket_today.
    function quantile(values,percentile){
      const sorted=[...values].sort((a,b)=>a-b);
      const index=(sorted.length-1)*percentile;
      const lower=Math.floor(index),upper=Math.ceil(index);
      if(lower===upper)return sorted[lower];
      const lowerValue=sorted[lower],upperValue=sorted[upper]??lowerValue;
      return lowerValue+(upperValue-lowerValue)*(index-lower);
    }
    function preferenceOffset(profile){if(profile==="hot")return 10;if(profile==="cold")return-10;return 0}
    function bandFromFeelsLikeF(value){
      if(value<=0)return"Don't Go Outside";
      if(value<=40)return"Winter Jacket";
      if(value<=55)return"Heavy Jacket";
      if(value<=65)return"Light Jacket";
      if(value<=70)return"Long Sleeve";
      if(value<=85)return"Short Sleeve";
      return"Shirtless";
    }
    function outfitKeyForBand(label){
      const lower=label.toLowerCase();
      if(lower.includes("don't go outside"))return"dontgo";
      if(lower.includes("winter"))return"winter";
      if(lower.includes("heavy"))return"heavy";
      if(lower.includes("light"))return"light";
      if(lower.includes("long"))return"long";
      if(lower.includes("short sleeve"))return"short";
      if(lower.includes("shirtless"))return"shirtless";
      return"short";
    }
    function decideFromWeather(weather,horizon=HORIZON_HOURS,profile=state.profile){
      const slice=weather.hourly.slice(0,horizon);
      const feelsF=slice.map(entry=>Number.isFinite(entry.feelsLike)?entry.feelsLike:entry.temperature);
      if(!feelsF.length)throw new Error("No forecast hours available for a clothing decision");
      const p10=quantile(feelsF,.1);
      const offset=preferenceOffset(profile);
      const adjustedP10=p10+offset;
      const band=bandFromFeelsLikeF(adjustedP10);
      const precipIndex=slice.findIndex(entry=>(entry.precipProbability??0)>=50);
      const umbrella=precipIndex>=0?{label:"Yes",when:formatHour(slice[precipIndex].time,weather.timezone),index:precipIndex}:{label:"No",when:null,index:-1};
      const peakRain=Math.max(...slice.map(entry=>entry.precipProbability??0));
      const peakWind=Math.max(weather.current.windSpeed??0,...slice.map(entry=>entry.windSpeed??0));
      const low=Math.min(...feelsF);
      return{band,key:outfitKeyForBand(band),p10,adjustedP10,offset,umbrella,peakRain,peakWind,low,slice};
    }

    // Every supported outfit/rain combination has a standalone generated asset.
    function otterSprite(key,showUmbrella){
      const variant=showUmbrella&&key!=="dontgo"?"yes":"no";
      const file=OTTER_FILES[key]?.[variant];
      return{variant,src:file?`${OTTER_ASSET_BASE}${file}`:""};
    }
    function updateMascot(key,showUmbrella){
      const{variant,src}=otterSprite(key,showUmbrella);
      const altBase=AVATAR_ALT_LABELS[key]||"Weather outfit";
      const alt=key==="dontgo"?altBase:`${altBase}${showUmbrella?" with umbrella":" without umbrella"}`;
      const token=++state.mascotToken;
      els.mascotImage.classList.add("changing");
      els.mascotImage.setAttribute("aria-label",alt);
      if(!src){
        els.mascotImage.style.backgroundImage="none";
        els.mascotImage.classList.remove("ready","changing");
        return;
      }
      const preload=new Image();
      preload.onload=()=>{
        if(token!==state.mascotToken)return;
        els.mascotImage.style.backgroundImage=`url(${JSON.stringify(src)})`;
        els.mascotImage.style.backgroundSize="contain";
        els.mascotImage.style.backgroundPosition="center bottom";
        els.mascotImage.dataset.variant=variant;
        els.mascotImage.dataset.outfit=key;
        els.mascotImage.classList.remove("changing");
        els.mascotImage.classList.add("ready");
      };
      preload.onerror=()=>{
        if(token!==state.mascotToken)return;
        els.mascotImage.style.backgroundImage="none";
        els.mascotImage.classList.remove("ready","changing");
      };
      preload.src=src;
    }

    function setLoading(value){state.loading=value}
    let toastTimer;
    function toast(message){clearTimeout(toastTimer);els.toast.textContent=message;els.toast.classList.add("show");toastTimer=setTimeout(()=>els.toast.classList.remove("show"),5200)}
    function relativeTime(iso){const mins=Math.max(0,Math.round((Date.now()-new Date(iso).getTime())/60000));return mins<=1?"Updated just now":mins<60?`Updated ${mins} min ago`:`Updated ${new Date(iso).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})}`}

    function render(){
      document.querySelectorAll(".unit-button").forEach(button=>button.classList.toggle("active",button.dataset.unit===state.unit));
      document.querySelectorAll(".profile-button").forEach(button=>button.classList.toggle("active",button.dataset.profile===state.profile));
      els.locationName.textContent=state.location.name;
      els.geoStatusText.textContent=state.locationMode==="geolocation"?"Using current location":state.location.name;
      if(!state.weather)return;
      const weather=state.weather;
      const decision=decideFromWeather(weather);
      const copy=BAND_COPY[decision.band];
      const [phrase,icon,type,background]=descriptor(weather.current);
      const hour=localHour(weather.current.time||Date.now(),weather.timezone);
      const isNight=hour<6||hour>=20;
      const next24=weather.hourly.slice(0,DISPLAY_HOURS);
      const high=Math.max(weather.current.temperature,...next24.map(entry=>entry.temperature));
      const low=Math.min(weather.current.temperature,...next24.map(entry=>entry.temperature));
      const umbrellaYes=decision.umbrella.label==="Yes";

      document.body.dataset.weather=type;
      els.hero.dataset.weather=type;
      els.hero.dataset.daypart=isNight?"night":"day";
      els.hero.dataset.background=background;
      els.hero.dataset.outfit=decision.key;
      els.hero.classList.add("generated-background");
      els.hero.style.setProperty("--weather-background",`url("${BACKGROUND_ASSET_BASE}${isNight?"night":"day"}-${background}.webp")`);
      els.temperature.textContent=temp(weather.current.temperature);
      els.weatherIcon.textContent=isNight&&type==="clear"?"🌙":icon;
      els.condition.textContent=phrase;
      els.highLow.textContent=`H: ${temp(high)} · L: ${temp(low)}`;
      els.verdict.innerHTML=copy.headline;
      const profileText=decision.offset===0?"":` Your ${state.profile==="hot"?"Always hot":"Always cold"} profile shifts that to ${temp(decision.adjustedP10)}.`;
      els.reason.textContent=`The cold-end feels-like for the next six hours is ${temp(decision.p10)}.${profileText}`;
      const status=state.dataMode==="cached"?"Saved forecast":state.dataMode==="demo"?"Preview weather":"Live weather";
      els.updated.textContent=`${status} · ${relativeTime(weather.fetchedAt||weather.updatedAt)}`;

      updateMascot(decision.key,umbrellaYes);
      els.jacketIcon.textContent=copy.icon;
      els.jacketTitle.textContent=copy.title;
      els.jacketStatus.textContent=decision.key==="dontgo"?"Stay inside":"Recommended";
      els.jacketDescription.textContent=copy.desc;
      els.jacketCard.classList.remove("off");

      els.umbrellaCard.classList.toggle("off",!umbrellaYes);
      els.umbrellaStatus.textContent=umbrellaYes?"Recommended":"Not needed";
      els.umbrellaDescription.textContent=umbrellaYes?`Rain reaches 50% at ${decision.umbrella.when}.`:"No hour reaches a 50% rain chance in the next six hours.";

      els.feelsLike.textContent=temp(weather.current.feelsLike);
      const feelDelta=weather.current.feelsLike-weather.current.temperature;
      els.feelsNote.textContent=Math.abs(feelDelta)<2?"About the same":feelDelta<0?"Cooler than air temp":"Warmer than air temp";
      els.wind.textContent=wind(weather.current.windSpeed||0);
      els.windNote.textContent=decision.peakWind>=25?"Strong wind":decision.peakWind>=16?"Noticeable breeze":"Light breeze";
      els.rain.textContent=`${Math.round(decision.peakRain)}%`;
      els.rainNote.textContent=umbrellaYes?"Umbrella threshold met":"Below 50% for six hours";
      els.sixHourLow.textContent=temp(decision.adjustedP10);
      els.trendNote.textContent=decision.offset===0?"10th percentile":`${decision.offset>0?"+":""}${decision.offset}° profile adjustment`;
      renderHourly(weather.hourly);
    }

    function renderHourly(hours){
      els.hourlyForecast.innerHTML=hours.slice(0,DISPLAY_HOURS).map((entry,index)=>{
        const [phrase,icon]=descriptor(entry);
        const label=index===0?"Now":formatHour(entry.time,state.weather?.timezone);
        const rain=Math.round(entry.precipProbability||0);
        return`<div class="hour ${index===0?"now":""}" title="${escapeHtml(phrase)}" aria-label="${escapeHtml(label)}, ${escapeHtml(phrase)}, ${temp(entry.temperature)}, ${rain?`${rain}% chance of rain`:"dry"}"><div class="hour-time">${label}</div><div class="hour-condition">${escapeHtml(phrase)}</div><div class="hour-icon" aria-hidden="true">${icon}</div><div class="hour-temp">${temp(entry.temperature)}</div><div class="hour-rain ${rain?"":"dry"}">${rain?`${rain}%`:"Dry"}</div></div>`;
      }).join("");
    }

    async function loadWeather(location,mode="manual"){
      setLoading(true);
      state.location=location;
      state.locationMode=mode;
      render();
      try{
        let data,primaryError;
        if(CONFIG.weatherCompanyProxy){
          try{data=await fetchWeatherCompanyProxy(location)}catch(error){primaryError=error;console.warn("Primary provider failed",error)}
        }
        if(!data)data=await fetchOpenMeteo(location);
        data.fetchedAt=new Date().toISOString();
        state.weather=data;
        state.dataMode=data.provider==="Weather demo"?"demo":"live";
        saveCache(location,mode,data);
        if(mode==="manual")storageSet("naj.manualLocation",JSON.stringify(location));
        storageSet("naj.locationMode",mode);
        render();
        if(primaryError)toast("The primary weather source was unavailable; a live forecast is still shown.");
      }catch(error){
        console.error(error);
        const cached=loadCache(location);
        if(cached){state.weather=cached.data;state.dataMode="cached";render();toast("Showing the most recent saved forecast.")}
        else{state.dataMode="error";els.updated.textContent="Weather unavailable";els.condition.textContent="Could not load weather";els.reason.textContent="Check your connection and try again.";toast("Weather could not be loaded.")}
      }finally{setLoading(false)}
    }

    async function fetchWeatherCompanyProxy(location){
      const url=new URL(CONFIG.weatherCompanyProxy,window.location.href);
      url.searchParams.set("lat",location.latitude);
      url.searchParams.set("lon",location.longitude);
      const response=await fetch(url,{headers:{Accept:"application/json"},cache:"no-store"});
      if(!response.ok)throw new Error(`Weather Company proxy returned ${response.status}`);
      const data=await response.json();
      if(!data?.current||!Array.isArray(data?.hourly))throw new Error("Invalid proxy response");
      return data;
    }

    async function fetchOpenMeteo(location){
      const demoMode=new URLSearchParams(window.location.search||"").get("demo");
      if(demoMode)return demoWeather(demoMode);
      const url=new URL("https://api.open-meteo.com/v1/forecast");
      url.search=new URLSearchParams({latitude:location.latitude,longitude:location.longitude,current:"temperature_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation,rain",hourly:"temperature_2m,apparent_temperature,precipitation_probability,weather_code,wind_speed_10m",temperature_unit:"fahrenheit",wind_speed_unit:"mph",precipitation_unit:"inch",timezone:"auto",timeformat:"unixtime",forecast_days:"2"});
      const response=await fetch(url,{cache:"no-store"});
      if(!response.ok)throw new Error(`Open-Meteo returned ${response.status}`);
      const raw=await response.json();
      const currentEpoch=Number(raw.current.time);
      const start=Math.max(0,raw.hourly.time.findIndex(time=>Number(time)>=currentEpoch-1800));
      const hourly=raw.hourly.time.slice(start,start+DISPLAY_HOURS).map((time,index)=>{
        const i=start+index;
        return{time:new Date(Number(time)*1000).toISOString(),temperature:raw.hourly.temperature_2m[i],feelsLike:raw.hourly.apparent_temperature[i],precipProbability:raw.hourly.precipitation_probability[i]??0,weatherCode:raw.hourly.weather_code[i],windSpeed:raw.hourly.wind_speed_10m[i]};
      });
      return{provider:"Open-Meteo",updatedAt:new Date(currentEpoch*1000).toISOString(),timezone:raw.timezone,current:{time:new Date(currentEpoch*1000).toISOString(),temperature:raw.current.temperature_2m,feelsLike:raw.current.apparent_temperature,precipProbability:hourly[0]?.precipProbability||0,weatherCode:raw.current.weather_code,windSpeed:raw.current.wind_speed_10m,precipitation:raw.current.precipitation||raw.current.rain||0},hourly};
    }

    function saveCache(location,mode,data){try{storageSet("naj.weatherCache",JSON.stringify({location,mode,data,savedAt:Date.now()}))}catch{}}
    function loadCache(location){try{const cached=JSON.parse(storageGet("naj.weatherCache")||"null");if(!cached||Date.now()-cached.savedAt>CONFIG.cacheMaxAgeMs)return null;return Math.abs(cached.location.latitude-location.latitude)<.03&&Math.abs(cached.location.longitude-location.longitude)<.03?cached:null}catch{return null}}
    function openModal(){els.locationModal.classList.add("open");els.locationButton.setAttribute("aria-expanded","true");setTimeout(()=>els.searchInput.focus(),80)}
    function closeModal(){els.locationModal.classList.remove("open");els.locationButton.setAttribute("aria-expanded","false");els.modalStatus.textContent=""}

    async function searchLocations(query){
      const clean=query.trim();if(!clean)return;
      els.modalStatus.textContent="Searching…";els.searchResults.innerHTML="";
      try{
        const coordinate=parseCoordinateQuery(clean);
        if(coordinate){const name=await resolveLocationName(coordinate.latitude,coordinate.longitude);closeModal();return loadWeather({name,latitude:coordinate.latitude,longitude:coordinate.longitude},"manual")}
        const url=new URL("https://geocoding-api.open-meteo.com/v1/search");
        url.search=new URLSearchParams({name:clean,count:"7",language:"en",format:"json"});
        const response=await fetch(url);if(!response.ok)throw new Error("Search failed");
        const data=await response.json(),results=data.results||[];
        els.modalStatus.textContent=results.length?"":"No matching locations found.";
        els.searchResults.innerHTML=results.map((result,index)=>{const sub=[result.admin1,result.country].filter(Boolean).join(", ");return`<button class="result-button" type="button" data-result="${index}"><span><span class="result-main">${escapeHtml(result.name)}</span><span class="result-sub">${escapeHtml(sub)}</span></span><span>→</span></button>`}).join("");
        els.searchResults.querySelectorAll("[data-result]").forEach(button=>button.addEventListener("click",()=>{const result=results[Number(button.dataset.result)],sub=[result.admin1,result.country_code==="US"?null:result.country].filter(Boolean).join(", "),name=sub?`${result.name}, ${sub}`:result.name;closeModal();loadWeather({name,latitude:result.latitude,longitude:result.longitude},"manual")}));
      }catch{els.modalStatus.textContent="Location search is unavailable right now."}
    }

    function parseCoordinateQuery(query){const match=query.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);if(!match)return null;const latitude=Number(match[1]),longitude=Number(match[2]);return Number.isFinite(latitude)&&Number.isFinite(longitude)?{latitude,longitude}:null}
    async function resolveLocationName(latitude,longitude){
      try{
        const url=new URL("https://api.bigdatacloud.net/data/reverse-geocode-client");
        url.search=new URLSearchParams({latitude:String(latitude),longitude:String(longitude),localityLanguage:"en"});
        const response=await fetch(url);if(!response.ok)throw new Error("Reverse geocoding failed");
        const data=await response.json();
        const locality=data.city||data.locality||data.principalSubdivision;
        const region=data.countryCode==="US"?data.principalSubdivisionCode?.split("-").pop():data.countryName;
        return[locality,region].filter(Boolean).join(", ")||"Current location";
      }catch{return"Current location"}
    }

    function requestCurrentLocation({automatic=false}={}){
      if(!navigator.geolocation){if(!automatic)toast("This browser does not support location access.");return Promise.reject(new Error("Unsupported"))}
      if(!automatic)els.modalStatus.textContent="Getting your location…";
      return new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(async position=>{
        const latitude=position.coords.latitude,longitude=position.coords.longitude;
        const name=await resolveLocationName(latitude,longitude);
        closeModal();
        loadWeather({name,latitude,longitude},"geolocation").then(resolve,reject);
      },error=>{
        if(!automatic){
          const message=error.code===1
            ?"Location access was blocked. Allow it in your browser settings, or choose a city."
            :error.code===3
              ?"Location lookup timed out. Try again, or choose a city."
              :"We could not determine your location. Try again, or choose a city.";
          els.modalStatus.textContent=message;
          toast(message);
        }
        reject(error);
      },{enableHighAccuracy:false,timeout:25000,maximumAge:5*60*1000}));
    }

    async function initializeLocation(){
      if(navigator.permissions?.query){
        try{const permission=await navigator.permissions.query({name:"geolocation"});if(permission.state==="granted"){document.documentElement.dataset.locationBootstrap="granted";try{await requestCurrentLocation({automatic:true});document.documentElement.dataset.locationBootstrap="current";return}catch{document.documentElement.dataset.locationBootstrap="current-failed"}}}catch{}
      }
      const previousMode=storageGet("naj.locationMode"),manual=safeJson(storageGet("naj.manualLocation"));
      if(previousMode==="manual"&&manual?.latitude&&manual?.longitude)await loadWeather(manual,"manual");
      else{document.documentElement.dataset.locationBootstrap="fallback";await loadWeather(CONFIG.defaultLocation,"default")}
    }

    function demoWeather(mode="heavy-rain"){
      const rainy=mode.includes("rain")||mode==="storm";
      const baseMode=mode.replace(/-?rain/g,"");
      const presets={dontgo:{temperature:-3,feelsLike:-8,code:71,wind:18},winter:{temperature:30,feelsLike:24,code:71,wind:12},heavy:{temperature:51,feelsLike:48,code:3,wind:10},light:{temperature:63,feelsLike:60,code:2,wind:9},long:{temperature:70,feelsLike:68,code:2,wind:7},short:{temperature:80,feelsLike:78,code:1,wind:5},shirtless:{temperature:94,feelsLike:90,code:0,wind:4},storm:{temperature:62,feelsLike:58,code:95,wind:28}};
      const preset=presets[baseMode]||presets[mode]||presets.heavy;
      const start=new Date();start.setMinutes(0,0,0);
      const rain=rainy?78:12;
      const code=rainy&&!([71,73,75].includes(preset.code))?(mode==="storm"?95:63):preset.code;
      return{provider:"Weather demo",fetchedAt:new Date().toISOString(),updatedAt:new Date().toISOString(),timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,current:{time:new Date().toISOString(),temperature:preset.temperature,feelsLike:preset.feelsLike,precipProbability:rain,precipitation:rainy?.08:0,weatherCode:code,windSpeed:preset.wind},hourly:Array.from({length:DISPLAY_HOURS},(_,index)=>({time:new Date(start.getTime()+index*3600000).toISOString(),temperature:preset.temperature+(index<6?index*.15:1-index*.15),feelsLike:preset.feelsLike+(index<6?index*.1:.5-index*.15),precipProbability:rainy&&index<6?Math.max(50,rain-index*3):Math.max(0,rain-index*2),weatherCode:code,windSpeed:preset.wind+(index%3)}))};
    }

    document.querySelectorAll(".unit-button").forEach(button=>button.addEventListener("click",()=>{state.unit=button.dataset.unit;storageSet("naj.unit",state.unit);render()}));
    document.querySelectorAll(".profile-button").forEach(button=>button.addEventListener("click",()=>{state.profile=button.dataset.profile;storageSet("naj.profile",state.profile);render()}));
    els.locationButton.addEventListener("click",openModal);
    els.closeModal.addEventListener("click",closeModal);
    els.locationModal.addEventListener("click",event=>{if(event.target===els.locationModal)closeModal()});
    document.addEventListener("keydown",event=>{if(event.key==="Escape")closeModal()});
    els.searchForm.addEventListener("submit",event=>{event.preventDefault();searchLocations(els.searchInput.value)});
    els.useCurrentLocation.addEventListener("click",()=>requestCurrentLocation().catch(()=>{}));
    els.useCurrentLocationTop.addEventListener("click",()=>requestCurrentLocation().catch(()=>{}));

    render();
    initializeLocation();
  })();
