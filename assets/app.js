(()=>{"use strict";
    const HORIZON_HOURS=6;
    const DISPLAY_HOURS=24;
    const CONFIG={
      weatherCompanyApiBase:"https://api.weather.com",
      weatherCompanyApiKey:"e1f10a1e78da46f5b10a1e78da96f525",
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
    const CITY_BACKGROUND_ASSET_BASE="city-backgrounds/v1/";
    const BACKGROUND_ASSET_VERSION="20260716-1";
    const CITY_BACKGROUNDS=window.NAJ_CITY_BACKGROUNDS||{aliases:{},backgrounds:{}};
    const CITY_BACKGROUND_CENTERS={
      amsterdam:[52.3676,4.9041],bangkok:[13.7563,100.5018],barcelona:[41.3874,2.1686],beijing:[39.9042,116.4074],berlin:[52.52,13.405],boston:[42.3601,-71.0589],"buenos-aires":[-34.6037,-58.3816],cairo:[30.0444,31.2357],"cape-town":[-33.9249,18.4241],chicago:[41.8781,-87.6298],delhi:[28.6139,77.209],dubai:[25.2048,55.2708],"hong-kong":[22.3193,114.1694],istanbul:[41.0082,28.9784],jakarta:[-6.2088,106.8456],"kuala-lumpur":[3.139,101.6869],kyoto:[35.0116,135.7681],london:[51.5074,-.1278],"los-angeles":[34.0522,-118.2437],madrid:[40.4168,-3.7038],manila:[14.5995,120.9842],"mexico-city":[19.4326,-99.1332],milan:[45.4642,9.19],mumbai:[19.076,72.8777],nairobi:[-1.2921,36.8219],"new-york":[40.7128,-74.006],paris:[48.8566,2.3522],prague:[50.0755,14.4378],"rio-de-janeiro":[-22.9068,-43.1729],rome:[41.9028,12.4964],"san-francisco":[37.7749,-122.4194],"sao-paulo":[-23.5505,-46.6333],seoul:[37.5665,126.978],shanghai:[31.2304,121.4737],singapore:[1.3521,103.8198],sydney:[-33.8688,151.2093],tokyo:[35.6762,139.6503],toronto:[43.6532,-79.3832],vancouver:[49.2827,-123.1207],vienna:[48.2082,16.3738]
    };
    const CITY_BACKGROUND_RADIUS_KM=100;
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
    const state={unit:storageGet("naj.unit")||"fahrenheit",profile:storageGet("naj.profile")||"regular",location:{...CONFIG.defaultLocation,name:"Finding location…"},locationMode:"loading",weather:null,loading:false,dataMode:"loading",mascotToken:0,weatherRequestToken:0};
    const $=id=>document.getElementById(id);
    const els={locationButton:$("locationButton"),locationName:$("locationName"),geoStatusText:$("geoStatusText"),refreshWeather:$("refreshWeather"),locationModal:$("locationModal"),closeModal:$("closeModal"),searchForm:$("searchForm"),searchInput:$("searchInput"),searchResults:$("searchResults"),modalStatus:$("modalStatus"),useCurrentLocation:$("useCurrentLocation"),useCurrentLocationTop:$("useCurrentLocationTop"),toast:$("toast"),temperature:$("temperature"),weatherIcon:$("weatherIcon"),condition:$("condition"),highLow:$("highLow"),verdict:$("verdict"),reason:$("reason"),updated:$("updated"),hero:$("hero"),mascot:$("mascot"),mascotImage:$("mascotImage"),jacketCard:$("jacketCard"),jacketIcon:$("jacketIcon"),jacketTitle:$("jacketTitle"),jacketStatus:$("jacketStatus"),jacketDescription:$("jacketDescription"),umbrellaCard:$("umbrellaCard"),umbrellaStatus:$("umbrellaStatus"),umbrellaDescription:$("umbrellaDescription"),feelsLike:$("feelsLike"),feelsNote:$("feelsNote"),wind:$("wind"),windNote:$("windNote"),rain:$("rain"),rainNote:$("rainNote"),sixHourLow:$("sixHourLow"),trendNote:$("trendNote"),hourlyForecast:$("hourlyForecast")};
    const CODES={0:["Clear","☀️","clear"],1:["Mostly clear","🌤️","clear"],2:["Partly cloudy","⛅","cloud"],3:["Cloudy","☁️","cloud"],45:["Foggy","🌫️","cloud"],48:["Foggy","🌫️","cloud"],51:["Light drizzle","🌦️","rain"],53:["Drizzle","🌦️","rain"],55:["Heavy drizzle","🌧️","rain"],56:["Freezing drizzle","🌧️","rain"],57:["Freezing drizzle","🌧️","rain"],61:["Light rain","🌦️","rain"],63:["Rain","🌧️","rain"],65:["Heavy rain","🌧️","rain"],66:["Freezing rain","🌧️","rain"],67:["Freezing rain","🌧️","rain"],71:["Light snow","🌨️","snow"],73:["Snow","🌨️","snow"],75:["Heavy snow","❄️","snow"],77:["Snow grains","❄️","snow"],80:["Rain showers","🌦️","rain"],81:["Rain showers","🌧️","rain"],82:["Heavy showers","⛈️","storm"],85:["Snow showers","🌨️","snow"],86:["Heavy snow showers","❄️","snow"],95:["Thunderstorms","⛈️","storm"],96:["Thunderstorms","⛈️","storm"],99:["Severe thunderstorms","⛈️","storm"]};
    const safeJson=v=>{try{return v?JSON.parse(v):null}catch{return null}};
    const escapeHtml=v=>String(v??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
    const convertTemp=f=>state.unit==="fahrenheit"?f:(f-32)*5/9;
    const convertWind=m=>state.unit==="fahrenheit"?m:m*1.60934;
    const temp=v=>`${Math.round(convertTemp(v))}°`;
    const wind=v=>`${Math.round(convertWind(v))} ${state.unit==="fahrenheit"?"mph":"km/h"}`;
    const localHour=(date,zone)=>Number(new Intl.DateTimeFormat("en-US",{timeZone:zone||undefined,hour:"2-digit",hourCycle:"h23"}).format(new Date(date)));
    const formatHour=(date,zone)=>new Date(date).toLocaleTimeString([],{hour:"numeric",timeZone:zone||undefined});

    function locationSlug(value){
      return String(value||"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
    }
    function distanceKm(latitudeA,longitudeA,latitudeB,longitudeB){
      const radians=value=>value*Math.PI/180;
      const latitudeDelta=radians(latitudeB-latitudeA),longitudeDelta=radians(longitudeB-longitudeA);
      const a=Math.sin(latitudeDelta/2)**2+Math.cos(radians(latitudeA))*Math.cos(radians(latitudeB))*Math.sin(longitudeDelta/2)**2;
      return 6371*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
    }
    function cityKeyForLocation(location){
      const names=[location?.city,String(location?.name||"").split(",")[0]];
      const latitude=Number(location?.latitude),longitude=Number(location?.longitude);
      if(!Number.isFinite(latitude)||!Number.isFinite(longitude))return"";
      for(const name of names){
        const key=CITY_BACKGROUNDS.aliases?.[locationSlug(name)],center=CITY_BACKGROUND_CENTERS[key];
        if(key&&center&&distanceKm(latitude,longitude,center[0],center[1])<=CITY_BACKGROUND_RADIUS_KM)return key;
      }
      return"";
    }
    function backgroundAssetFor(location,daypart,condition){
      const cityKey=cityKeyForLocation(location);
      const cityAsset=CITY_BACKGROUNDS.backgrounds?.[cityKey]?.[`${daypart}-${condition}`];
      return cityAsset
        ?{src:`${CITY_BACKGROUND_ASSET_BASE}${cityAsset}?v=${BACKGROUND_ASSET_VERSION}`,source:"city",cityKey}
        :{src:`${BACKGROUND_ASSET_BASE}${daypart}-${condition}.webp?v=${BACKGROUND_ASSET_VERSION}`,source:"generic",cityKey:""};
    }

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
      if(value<92)return"Short Sleeve";
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
      els.mascotImage.classList.remove("ready");
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
    function relativeTime(iso){
      const seconds=Math.max(0,Math.floor((Date.now()-new Date(iso).getTime())/1000));
      if(seconds<60)return"Updated just now";
      const minutes=Math.floor(seconds/60);if(minutes<60)return`Updated ${minutes}m ago`;
      const hours=Math.floor(minutes/60);if(hours<24)return`Updated ${hours}h ago`;
      return`Updated ${Math.floor(hours/24)}d ago`;
    }
    function updateFreshness(){
      if(!state.weather)return;
      const status=state.dataMode==="cached"?"Saved forecast":state.dataMode==="demo"?"Preview weather":"Live weather";
      els.updated.textContent=`${status} · ${relativeTime(state.weather.fetchedAt||state.weather.updatedAt)}`;
    }
    function renderPendingWeather(){
      els.temperature.textContent="—";els.weatherIcon.textContent="";els.condition.textContent="Updating conditions…";els.highLow.textContent="";
      els.verdict.textContent="Checking outside…";els.reason.textContent=`Getting the latest six-hour outlook for ${state.location.name}.`;els.updated.textContent="";
      els.jacketStatus.textContent="Updating";els.umbrellaStatus.textContent="Updating";els.hourlyForecast.innerHTML="";
      els.feelsLike.textContent="—";els.wind.textContent="—";els.rain.textContent="—";els.sixHourLow.textContent="—";
      els.mascotImage.style.backgroundImage="none";els.mascotImage.classList.remove("ready","changing");
    }

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
      const daypart=isNight?"night":"day";
      const backgroundAsset=backgroundAssetFor(state.location,daypart,background);
      const next24=weather.hourly.slice(0,DISPLAY_HOURS);
      const high=Math.max(weather.current.temperature,...next24.map(entry=>entry.temperature));
      const low=Math.min(weather.current.temperature,...next24.map(entry=>entry.temperature));
      const umbrellaYes=decision.umbrella.label==="Yes";

      document.body.dataset.weather=type;
      els.hero.dataset.weather=type;
      els.hero.dataset.daypart=daypart;
      els.hero.dataset.background=background;
      els.hero.dataset.backgroundSource=backgroundAsset.source;
      if(backgroundAsset.cityKey)els.hero.dataset.backgroundCity=backgroundAsset.cityKey;else delete els.hero.dataset.backgroundCity;
      els.hero.dataset.outfit=decision.key;
      els.hero.classList.add("generated-background");
      els.hero.style.setProperty("--weather-background",`url("${backgroundAsset.src}")`);
      els.temperature.textContent=temp(weather.current.temperature);
      els.weatherIcon.textContent=isNight&&type==="clear"?"🌙":icon;
      els.condition.textContent=phrase;
      els.highLow.textContent=`H: ${temp(high)} · L: ${temp(low)}`;
      els.verdict.innerHTML=copy.headline;
      const profileText=decision.offset===0?"":` Your ${state.profile==="hot"?"Always hot":"Always cold"} profile shifts that to ${temp(decision.adjustedP10)}.`;
      els.reason.textContent=`The cold-end feels-like for the next six hours is ${temp(decision.p10)}.${profileText}`;
      updateFreshness();

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

    async function loadWeather(location,mode="manual",{preserveCurrent=false}={}){
      const requestToken=++state.weatherRequestToken;
      setLoading(true);
      state.location=location;
      state.locationMode=mode;
      if(!preserveCurrent)state.weather=null;
      render();
      if(!preserveCurrent)renderPendingWeather();
      try{
        const data=await fetchWeatherUnderground(location);
        if(requestToken!==state.weatherRequestToken)return;
        data.fetchedAt=new Date().toISOString();
        state.weather=data;
        state.dataMode=data.provider==="Weather demo"?"demo":"live";
        saveCache(location,mode,data);
        if(mode==="manual")storageSet("naj.manualLocation",JSON.stringify(location));
        storageSet("naj.locationMode",mode);
        render();
      }catch(error){
        if(requestToken!==state.weatherRequestToken)return;
        console.error(error);
        const cached=loadCache(location);
        if(cached){state.weather=cached.data;state.dataMode="cached";render();toast("Showing the most recent saved forecast.")}
        else{state.dataMode="error";els.updated.textContent="Weather unavailable";els.condition.textContent="Could not load weather";els.reason.textContent="Check your connection and try again.";toast("Weather could not be loaded.")}
      }finally{if(requestToken===state.weatherRequestToken)setLoading(false)}
    }

    async function refreshWeather(){
      if(state.loading||!Number.isFinite(state.location?.latitude)||!Number.isFinite(state.location?.longitude))return;
      els.refreshWeather.disabled=true;els.refreshWeather.classList.add("refreshing");
      try{await loadWeather({...state.location},state.locationMode,{preserveCurrent:true})}
      finally{els.refreshWeather.disabled=false;els.refreshWeather.classList.remove("refreshing")}
    }

    async function fetchWeatherCompany(path,params={}){
      const url=new URL(path,CONFIG.weatherCompanyApiBase);
      url.search=new URLSearchParams({...params,language:"en-US",format:"json",apiKey:CONFIG.weatherCompanyApiKey});
      const response=await fetch(url,{headers:{Accept:"application/json"},cache:"no-store"});
      if(!response.ok)throw new Error(`Weather Underground returned ${response.status}`);
      return response.json();
    }

    async function fetchWeatherUnderground(location){
      const demoMode=new URLSearchParams(window.location.search||"").get("demo");
      if(demoMode)return demoWeather(demoMode);
      const geocode=`${location.latitude},${location.longitude}`;
      const common={geocode,units:"e"};
      const[current,forecast]=await Promise.all([
        fetchWeatherCompany("/v3/wx/observations/current",common),
        fetchWeatherCompany("/v3/wx/forecast/hourly/2day",common)
      ]);
      const count=Math.min(DISPLAY_HOURS,forecast.validTimeLocal?.length||0);
      const hourly=Array.from({length:count},(_,index)=>({
        time:forecast.validTimeLocal[index],
        temperature:forecast.temperature?.[index],
        feelsLike:forecast.temperatureFeelsLike?.[index]??forecast.temperature?.[index],
        precipProbability:forecast.precipChance?.[index]??0,
        phrase:forecast.wxPhraseLong?.[index]||forecast.wxPhraseShort?.[index]||"Variable conditions",
        windSpeed:forecast.windSpeed?.[index]??0,
        iconCode:forecast.iconCode?.[index]
      })).filter(hour=>Number.isFinite(hour.temperature));
      if(!Number.isFinite(current.temperature)||!hourly.length)throw new Error("Weather Underground returned an incomplete forecast");
      return{
        provider:"Weather Underground / The Weather Company",
        updatedAt:current.validTimeLocal||new Date().toISOString(),
        timezone:current.timezone||null,
        current:{
          time:current.validTimeLocal||hourly[0].time,
          temperature:current.temperature,
          feelsLike:current.temperatureFeelsLike??current.temperature,
          precipProbability:hourly[0].precipProbability,
          phrase:current.wxPhraseLong||current.wxPhraseMedium||current.wxPhraseShort||hourly[0].phrase,
          windSpeed:current.windSpeed??0,
          precipitation:current.precip1Hour??0,
          iconCode:current.iconCode
        },
        hourly
      };
    }

    function saveCache(location,mode,data){try{storageSet("naj.weatherCache.wu",JSON.stringify({location,mode,data,savedAt:Date.now()}))}catch{}}
    function loadCache(location){try{const cached=JSON.parse(storageGet("naj.weatherCache.wu")||"null");if(!cached||Date.now()-cached.savedAt>CONFIG.cacheMaxAgeMs)return null;return Math.abs(cached.location.latitude-location.latitude)<.03&&Math.abs(cached.location.longitude-location.longitude)<.03?cached:null}catch{return null}}
    function openModal(){els.locationModal.classList.add("open");els.locationButton.setAttribute("aria-expanded","true");setTimeout(()=>els.searchInput.focus(),80)}
    function closeModal(){els.locationModal.classList.remove("open");els.locationButton.setAttribute("aria-expanded","false");els.modalStatus.textContent=""}

    async function searchLocations(query){
      const clean=query.trim();if(!clean)return;
      els.modalStatus.textContent="Searching…";els.searchResults.innerHTML="";
      try{
        const coordinate=parseCoordinateQuery(clean);
        if(coordinate){const name=await resolveLocationName(coordinate.latitude,coordinate.longitude);closeModal();return loadWeather({name,latitude:coordinate.latitude,longitude:coordinate.longitude},"manual")}
        const data=await fetchWeatherCompany("/v3/location/search",{query:clean});
        const locations=data.location||{},count=Math.min(7,locations.latitude?.length||0);
        const results=Array.from({length:count},(_,index)=>({
          name:locations.displayName?.[index]||locations.city?.[index]||clean,
          admin1:locations.adminDistrict?.[index],
          country:locations.country?.[index],
          countryCode:locations.countryCode?.[index],
          latitude:locations.latitude?.[index],
          longitude:locations.longitude?.[index]
        })).filter(result=>Number.isFinite(result.latitude)&&Number.isFinite(result.longitude));
        els.modalStatus.textContent=results.length?"":"No matching locations found.";
        els.searchResults.innerHTML=results.map((result,index)=>{const sub=[result.admin1,result.country].filter(Boolean).join(", ");return`<button class="result-button" type="button" data-result="${index}"><span><span class="result-main">${escapeHtml(result.name)}</span><span class="result-sub">${escapeHtml(sub)}</span></span><span>→</span></button>`}).join("");
        els.searchResults.querySelectorAll("[data-result]").forEach(button=>button.addEventListener("click",()=>{const result=results[Number(button.dataset.result)],sub=[result.admin1,result.countryCode==="US"?null:result.country].filter(Boolean).join(", "),name=sub?`${result.name}, ${sub}`:result.name;closeModal();loadWeather({name,latitude:result.latitude,longitude:result.longitude},"manual")}));
      }catch{els.modalStatus.textContent="Location search is unavailable right now."}
    }

    function parseCoordinateQuery(query){const match=query.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);if(!match)return null;const latitude=Number(match[1]),longitude=Number(match[2]);return Number.isFinite(latitude)&&Number.isFinite(longitude)?{latitude,longitude}:null}
    async function resolveLocationName(latitude,longitude){
      try{
        const data=await fetchWeatherCompany("/v3/location/point",{geocode:`${latitude},${longitude}`});
        const location=data.location||{};
        const locality=location.city||location.displayName;
        const region=location.countryCode==="US"?(location.adminDistrictCode||location.adminDistrict):location.country;
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
      const presets={dontgo:{temperature:-3,feelsLike:-8,code:71,wind:18},winter:{temperature:30,feelsLike:24,code:71,wind:12},heavy:{temperature:51,feelsLike:48,code:3,wind:10},light:{temperature:63,feelsLike:60,code:2,wind:9},long:{temperature:70,feelsLike:68,code:2,wind:7},short:{temperature:80,feelsLike:78,code:1,wind:5},shirtless:{temperature:94,feelsLike:94,code:0,wind:4},storm:{temperature:62,feelsLike:58,code:95,wind:28}};
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
    els.refreshWeather.addEventListener("click",refreshWeather);

    let hourlyDrag=null;
    els.hourlyForecast.addEventListener("pointerdown",event=>{
      if(event.pointerType==="touch"||event.button!==0)return;
      hourlyDrag={pointerId:event.pointerId,startX:event.clientX,startScrollLeft:els.hourlyForecast.scrollLeft,moved:false};
      els.hourlyForecast.setPointerCapture(event.pointerId);
    });
    els.hourlyForecast.addEventListener("pointermove",event=>{
      if(!hourlyDrag||event.pointerId!==hourlyDrag.pointerId)return;
      const delta=event.clientX-hourlyDrag.startX;
      if(!hourlyDrag.moved&&Math.abs(delta)<4)return;
      hourlyDrag.moved=true;
      els.hourlyForecast.classList.add("is-dragging");
      els.hourlyForecast.scrollLeft=hourlyDrag.startScrollLeft-delta;
      event.preventDefault();
    });
    const endHourlyDrag=event=>{
      if(!hourlyDrag||event.pointerId!==hourlyDrag.pointerId)return;
      if(els.hourlyForecast.hasPointerCapture(event.pointerId))els.hourlyForecast.releasePointerCapture(event.pointerId);
      hourlyDrag=null;
      els.hourlyForecast.classList.remove("is-dragging");
    };
    els.hourlyForecast.addEventListener("pointerup",endHourlyDrag);
    els.hourlyForecast.addEventListener("pointercancel",endHourlyDrag);

    render();
    initializeLocation();
    setInterval(updateFreshness,30000);
  })();
