const {app, BrowserWindow, dialog, Menu } = require('electron');
const url = require('url');
const path = require('path');
const { ipcMain } = require('electron');

app.on('before-quit', ()=> {
    console.log('Leaving...');
});

let win;

function createWindow() {

    win = new BrowserWindow({
        backgroundColor: '#141414',
        width: 800,
        height: 600,
        title: 'Simpli - An open source code editor and compiler',
        center: true,
        maxibizable: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true
        }
    });

    win.loadURL(
        url.format({
            pathname: path.join(__dirname, 'index.html'),
            protocol: 'file',
            slashes: true
        })
    );
}

const isMac = process.platform === 'darwin';

const menuPrincipal = [
    {
        label: 'File',
        submenu: [
            {
                label: 'New File',
                accelerator: 'CmdOrCtrl+N',
                click() {
                    dialog.showSaveDialog().then(archivoNuevo => {
                        if (!archivoNuevo.canceled){
                            win.webContents.send('NUEVO_ARCHIVO', archivoNuevo.filePath);
                        } 
                    }).catch(e => {
                        console.error(e);
                    });
                }
            },
            {
                label:'Open File',
                accelerator: 'CmdOrCtrl+O',
                click() {
                    dialog.showOpenDialog({
                        properties: ['openFile'],
                        filters: [
                            { name: 'Scripts', extensions: ['java', 'js', 'py'] }
                        ]
                    }).then(archivoAbrir => {
                        if (!archivoAbrir.canceled){
                            win.webContents.send('ABRIR_ARCHIVO', archivoAbrir.filePaths[0]);
                        }
                    }).catch(e => {
                        console.error(e);
                    });
                    
                } 
            },
            {
                label: 'Save',
                accelerator:'CmdOrCtrl+S',
                click(){
                    win.webContents.send('GUARDAR');
                }
            },
            { 
                label: 'Save As...', 
                accelerator:'CmdOrCtrl+Shift+S',
                click(){
                    win.webContents.send('GUARDAR_COMO_INIT');
                }
            },
            {
                label: 'Close File',
                accelerator: 'CmdOrCtrl+Shift+C',
                click(){
                    win.webContents.send('CERRAR_ARCHIVO_INIT');
                }
            },
            {
                type:'separator'
            },
            isMac ? {role: 'close', label: 'Exit'}:{role:'quit', label: 'Exit'}
        ]
    },
    {
        label: 'Edit',
        submenu: [
            {
                label: 'Undo',
                role: 'undo'
            },
            {
                label: 'Redo',
                role: 'redo'
            },
            {
                type:'separator'
            },
            {
                label: 'Cut',
                role: 'cut'
            },
            {
                label: 'Copy',
                role: 'copy'
            },
            {
                label: 'Paste',
                role: 'paste'
            }
        ]
    },
    {
        label:'View',
        submenu: [
            {
                label: 'Reload',
                role:'reload'
            },
            {
                label: 'Developer Tools',
                role:'toggledevtools'
            }
        ]
    },
    {
        label:'Run',
        submenu: [
            {
                label: 'Execute',
                accelerator: 'F5',
                click() {
                    win.webContents.send('EJECUTAR');
                }
            }
        ]
    }
   
];


ipcMain.on('show-context-menu', (event) => {
    const template = [
        {
            label: 'Menu Item 1',
            click: () => { event.sender.send('context-menu-command', 'menu-item-1'); }
        },
        { type: 'separator' },
        { label: 'Menu Item 2', type: 'checkbox', checked: true }
    ];
    const menu = Menu.buildFromTemplate(template);
    menu.popup(BrowserWindow.fromWebContents(event.sender));
});

//Mostrar dialogo de confirmar
ipcMain.on('DIALOG_CONFIRM', (event, text) => {
    dialog.showMessageBox(win, {
        message: text,
        buttons: ['Aceptar', 'Cancelar']
    }).then(result => {
        if (result.response === 0) {
            win.webContents.send('CERRAR_ARCHIVO');
        }
    });
});

//Mostrar dialogo de aceptar
ipcMain.on('DIALOG_ACCEPT', (event, text) => {
    dialog.showMessageBox(win, {
        message: text,
        buttons: ['Aceptar']
    });
});

ipcMain.on('CREAR_EDITOR', (event, lang, data) => {
    win.webContents.send('CREAR_EDITOR', lang, data);
});

ipcMain.on('GUARDAR_COMO', (event, lang, ext, data) => {
    dialog.showSaveDialog({
        filters: [
            { name: lang, extensions: [ext] }
        ]
    }).then(archivoGuardar => {
        if (!archivoGuardar.canceled){
            win.webContents.send('GUARDAR_COMO', archivoGuardar.filePath, data);
        } 
    }).catch(e => {
        console.error(e);
    });   
});


const menu  =  Menu.buildFromTemplate(menuPrincipal);
Menu.setApplicationMenu(menu);

app.on('ready', createWindow);