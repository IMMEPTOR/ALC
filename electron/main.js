const electron = require('electron');
const path = require('path');

const app = electron.app;
const BrowserWindow = electron.BrowserWindow;
const Menu = electron.Menu;

const DEV_URL = 'http://localhost:8081';

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    title: 'ALC — Контроль сборочных линий',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadURL(DEV_URL);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

const template = [
  {
    label: 'ALC',
    submenu: [
      { role: 'about', label: 'О приложении ALC' },
      { type: 'separator' },
      { role: 'quit', label: 'Выход' },
    ],
  },
  {
    label: 'Правка',
    submenu: [
      { role: 'undo', label: 'Отменить' },
      { role: 'redo', label: 'Повторить' },
      { type: 'separator' },
      { role: 'cut', label: 'Вырезать' },
      { role: 'copy', label: 'Копировать' },
      { role: 'paste', label: 'Вставить' },
      { role: 'selectAll', label: 'Выделить все' },
    ],
  },
  {
    label: 'Вид',
    submenu: [
      { role: 'reload', label: 'Обновить' },
      { role: 'forceReload', label: 'Принудительно обновить' },
      { role: 'toggleDevTools', label: 'Инструменты разработчика' },
      { type: 'separator' },
      { role: 'zoomIn', label: 'Увеличить' },
      { role: 'zoomOut', label: 'Уменьшить' },
      { role: 'resetZoom', label: 'Сбросить масштаб' },
      { type: 'separator' },
      { role: 'togglefullscreen', label: 'Полноэкранный режим' },
    ],
  },
];

app.whenReady().then(() => {
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
