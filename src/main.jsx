import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

navigator.serviceWorker.register('./sw.js');

let db=Window.indexdDB.open('database');
db.onupgradeneeded=event=>{
  let result=event.target.result;
  result.createObjectStore('table', {autoIncrement:true});
}



ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
