/**
 * Server-authoritative application state.
 * UI state is cached only for presentation; security telemetry always comes from the API.
 */
class ForensicsStateManager{
  constructor(){this.state={dashboard:null,notifications:[],connected:false};this.listeners=new Set();}
  subscribe(fn){this.listeners.add(fn);return()=>this.listeners.delete(fn);}
  publish(){this.listeners.forEach(fn=>fn(this.state));}
  async refreshDashboard(){
    const response=await fetch("/api/dashboard",{headers:{"Accept":"application/json"},credentials:"same-origin"});
    if(!response.ok) throw new Error(response.status===401?"Authentication required":"Unable to load dashboard data");
    this.state.dashboard=await response.json();this.state.connected=true;this.publish();return this.state.dashboard;
  }
  async refreshNotifications(){
    const response=await fetch("/api/notifications",{headers:{"Accept":"application/json"},credentials:"same-origin"});
    if(!response.ok)return[];
    this.state.notifications=await response.json();this.publish();return this.state.notifications;
  }
}
window.appState=new ForensicsStateManager();
