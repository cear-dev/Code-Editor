const { ipcRenderer, ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const exec = require('child_process').exec;
const amdLoader = require('../node_modules/monaco-editor/min/vs/loader.js');
const amdRequire = amdLoader.require;
const amdDefine = amdLoader.require.define;
var isSave = false;
var rutaArchivo;
var archivoExt;
var lang;
var archivoNombre;
var archivoNombrePuro;
var editor;

//INICIAR ENTORNO DE MONACO
(function () {

    function uriFromPath(_path) {
        var pathName = path.resolve(_path).replace(/\\/g, '/');
        if (pathName.length > 0 && pathName.charAt(0) !== '/') {
            pathName = '/' + pathName;
        }
        return encodeURI('file://' + pathName);
    }

    amdRequire.config({
        baseUrl: uriFromPath(path.join(__dirname, '../node_modules/monaco-editor/min'))
    });

    self.module = undefined;

    amdRequire(['vs/editor/editor.main'], function () {

        crearEditor();

        function crearEditor() {            

            editor = monaco.editor.create(document.getElementById('editor'), {
                automaticLayout: true,
                theme: 'vs-dark',
                value: [''].join('\n')
            });

            limpiarOutputOcultarEditor();
            
            //Detectar cambios
            editor.getModel().onDidChangeContent((event) => {
                setSaveEstatus(false);
            });
        }

    });   
})();


//MOSTRAR EDITOR
function mostrarEditor(lang, data){
    //Cargar
    document.getElementById('info').innerHTML = 'Cargando...';
    limpiarOutputOcultarEditor();
    document.getElementById('info-lang').innerHTML = lang;

    //Cambiar lenguaje
    monaco.editor.setModelLanguage(editor.getModel(), lang);

    //Poner data
    editor.getModel().setValue(data);

    //Aplicar nombre
    document.getElementById('info').innerHTML = archivoNombre;

    //Mostrar editor
    document.getElementById('editor').style.visibility = 'visible';

    //Estatus de guardado
    setSaveEstatus(true);

}

//CERRAR EDITOR
ipcRenderer.on('CERRAR_ARCHIVO_INIT', (event) => {
    if (!isSave){
        ipcRenderer.send('DIALOG_CONFIRM', '¿Está seguro de cerrar sin guardar?');
    } else {
        limpiarOutputOcultarEditor();
    }
});
ipcRenderer.on('CERRAR_ARCHIVO', (event) => {
    limpiarOutputOcultarEditor();
});        

//ABRIR ARCHIVO
ipcRenderer.on('ABRIR_ARCHIVO', (event, archivoRuta) => {
    rutaArchivo = archivoRuta;

    const data = 
    fs.readFileSync(
        rutaArchivo, 
        {encoding:'utf8', flag:'r'}
    );

    archivoNombre = path.basename(rutaArchivo);

    archivoNombrePuro = path.parse(rutaArchivo);
    
    archivoNombrePuro = archivoNombrePuro.name;

    archivoExt = path.extname(rutaArchivo);

    lang = checkLanguage(archivoExt);

    if (lang === undefined) {
        ipcRenderer.send('DIALOG_ACCEPT', 'El formato de archivo no es soportado');
    } else {
        mostrarEditor(lang, data);
    }
        
});

//VERIFICAR SI LA EXTENSION CORRESPONDE CON UN LENGUAJE SOPORTADO
function checkLanguage(ext){
    ext = ext.toLowerCase();
    let lenguajes = [['.java', 'java'], ['.js', 'javascript'], ['.py', 'python']];
    let lenguajeFinal;

    for (let i=0; i<lenguajes.length; i++){
        if (ext===lenguajes[i][0]){          
            lenguajeFinal = lenguajes[i][1];
        }
    }

    return lenguajeFinal;
}

//GUARDADO RAPIDO
ipcRenderer.on('GUARDAR', (event) => {
    const data = editor.getValue();
    if (!isSave){
        try {
            fs.writeFileSync(rutaArchivo, data);
            setSaveEstatus(true);
        } catch (e) {
            console.error(e);
            ipcRenderer.send('DIALOG_ACCEPT', 'Ocurrio un error al guardar el archivo. Por favor intente denuevo.');

        }
    }
});

//GUARDAR COMO
ipcRenderer.on('GUARDAR_COMO_INIT', (event) => {
    const data = editor.getValue();
    ipcRenderer.send('GUARDAR_COMO', lang, archivoExt.substring(1), data);
});

ipcRenderer.on('GUARDAR_COMO', (event, ruta, data) => {    
    try {
        fs.writeFileSync(ruta, data);
        setSaveEstatus(true);
    } catch (e) {
        console.error(e);
        ipcRenderer.send('DIALOG_ACCEPT', 'Ocurrio un error al guardar el archivo. Por favor intente denuevo.');

    }
});

//NUEVO ARCHIVO
ipcRenderer.on('NUEVO_ARCHIVO', (event, ruta) => {

    rutaArchivo = ruta;
    
    archivoNombre = path.basename(rutaArchivo);

    archivoExt = path.extname(rutaArchivo);

    lang = checkLanguage(archivoExt);

    if (lang === undefined) {
        ipcRenderer.send('DIALOG_ACCEPT', 'El formato de archivo no es soportado');
    } else {        
        try {
            fs.writeFileSync(rutaArchivo, '');
            mostrarEditor(lang, '');
        } catch (e) {
            console.error(e);
            ipcRenderer.send('DIALOG_ACCEPT', 'Ocurrio un error al crear el archivo. Por favor intente denuevo.');

        }
    }    
});

//Estatus de guardado
function setSaveEstatus(status){
    isSave = status;

    switch (status) {
    case true:
        setText('Guardado');
        break;

    case false:
        setText('Sin guardar');
        break;

    default:
        setText('Sin guardar');
        break;
    }

    function setText(textSave){
        document.getElementById('info-save').innerHTML = textSave;
    }
}


//EJECUTAR EN TERMINAL
ipcRenderer.on('EJECUTAR', (event) => {
    run();
});

function run(){
    //Texto de carga
    document.getElementById('salida').innerHTML = 'Compilando...';

    let langToExecuteArray = [['java', 'javac'], ['javascript', 'node'], ['python', 'python']];
    let langToExecute;

    for (let i=0; i<langToExecuteArray.length; i++){
        if (lang===langToExecuteArray[i][0]){          
            langToExecute = langToExecuteArray[i][1];
        }
    }

    //Crear archivo temporal de ejecución
    let dir = './.temp';
    let completeTempDir;
    const data = editor.getValue();

    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir);
    }

    completeTempDir = `${dir}/${archivoNombre}`;    

    fs.writeFileSync(completeTempDir, data);
    
    function ejecutar(command, callback) {
        exec(command, (error, stdout, stderr) => { 
            callback(stdout); 
        });
    }

    ejecutar((`${langToExecute} ${completeTempDir}`), (output) => {

        //SALIDA DEPENDIENDO DEL LENGUAJE
        if (lang=='java'){
            ejecutar((`java -cp ${dir}/ ${archivoNombrePuro}`), (javaOutput) => {
                mostrarOutputLimpiarTemporales(javaOutput, dir);
            });
        } else {
            mostrarOutputLimpiarTemporales(output, dir);
        }
        
    });
}

//MOSTRAR OUTPUT y ELIMINAR ARCHIVOS TEMPORALES
function mostrarOutputLimpiarTemporales(output, dir){
    //Eliminar directorio temporal y contenido
    fs.rmSync(dir, { recursive: true, force: true });
        
    //Mostrar respuesta
    document.getElementById('salida').innerHTML = output;
}

//LIMPIAR OUTPUT Y OCULTAR EDITOR
function limpiarOutputOcultarEditor() {    
    document.getElementById('editor').style.visibility = 'hidden';
    document.getElementById('salida').innerHTML = '';    
    document.getElementById('info-lang').innerHTML = '';
    document.getElementById('info').innerHTML = 'No se ha abierto ningún archivo';
    document.getElementById('info-save').innerHTML = 'Sin Abrir';
}