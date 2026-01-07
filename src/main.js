const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

const dbPath = path.join(app.getPath('documents'), 'clinica-dados.db');
let db;

function createWindow() {

    const mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        transparent: true,  
        frame: false,       
        webPreferences: {

            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true, 
            nodeIntegration: false 
        }
    });

    mainWindow.on('maximize', () => mainWindow.webContents.send('window-maximized', true));
    mainWindow.on('unmaximize', () => mainWindow.webContents.send('window-maximized', false));

    mainWindow.loadFile('src/index.html');
}

function initDatabase() {
    db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error('Erro ao abrir o banco de dados', err.message);
        } else {
            console.log('Conectado ao banco de dados SQLite.');
            db.serialize(() => { 
                db.run(`
                    CREATE TABLE IF NOT EXISTS pacientes (
                        id TEXT PRIMARY KEY,
                        nome TEXT NOT NULL,
                        telefone TEXT,
                        email TEXT,
                        nascimento TEXT,
                        cpf TEXT,
                        endereco TEXT,
                        observacoes TEXT
                    )
                `);

                db.run("ALTER TABLE pacientes ADD COLUMN dataCadastro TEXT", (err) => {
                    if (err && !err.message.includes('duplicate column')) {
                        console.error('Erro ao adicionar coluna dataCadastro:', err.message);
                    } else {
                        console.log('Coluna dataCadastro verificada/adicionada.');
                    }
                });
                
                db.run(`
                    CREATE TABLE IF NOT EXISTS consultas (
                        id TEXT PRIMARY KEY,
                        pacienteId TEXT NOT NULL,
                        data TEXT NOT NULL,
                        hora TEXT,
                        tipo TEXT,
                        status TEXT,
                        duracao TEXT,
                        observacoes TEXT,
                        FOREIGN KEY (pacienteId) REFERENCES pacientes(id)
                    )
                `);

                db.run(`
                    CREATE TABLE IF NOT EXISTS anamnese (
                        pacienteId TEXT PRIMARY KEY,
                        
                        -- Informações do Paciente (redundante, mas bom para impressão)
                        nome TEXT,
                        cpf TEXT,
                        data_nascimento TEXT,
                        endereco TEXT,
                        cep TEXT,
                        fone TEXT,
                        fone_emergencia TEXT,
                        email TEXT,
                        falar_com TEXT,

                        -- Perguntas da Anamnese (baseado na 2.jpg)
                        tratamento_medico INTEGER,
                        tratamento_medico_qual TEXT,
                        tomando_medicamento INTEGER,
                        tomando_medicamento_qual TEXT,
                        alergia_doenca INTEGER,
                        alergia_doenca_qual TEXT,
                        diabetico INTEGER,
                        doenca_coracao INTEGER,
                        hipertenso INTEGER,
                        hemofilico INTEGER,
                        pes_incham INTEGER,
                        tosse_persistente INTEGER,
                        alergia_anestesia INTEGER,
                        alergia_anestesia_qual TEXT,
                        submetido_anestesia INTEGER,
                        teve_hemorragia INTEGER,
                        tem_vicio INTEGER,
                        tem_vicio_qual TEXT,
                        esta_gravida INTEGER,
                        sofre_epilepsia INTEGER,
                        algo_a_declarar TEXT,
                        algo_a_declarar_qual TEXT,
                        
                        -- Odontograma (vamos salvar as anotações como texto)
                        odontograma_anotacoes TEXT,

                        FOREIGN KEY (pacienteId) REFERENCES pacientes(id)
                    )
                `);

                db.run(`
                    CREATE TABLE IF NOT EXISTS tratamentos (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        pacienteId TEXT NOT NULL,
                        data TEXT NOT NULL,
                        descricao TEXT NOT NULL,
                        valor_total REAL NOT NULL,
                        status_pagamento TEXT NOT NULL, 
                        
                        FOREIGN KEY (pacienteId) REFERENCES pacientes(id)
                    )
                `);

                db.run(`
                    CREATE TABLE IF NOT EXISTS pagamentos (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        tratamentoId INTEGER NOT NULL,
                        data TEXT NOT NULL,
                        valor_pago REAL NOT NULL,
                        forma_pagamento TEXT NOT NULL, 
                        
                        FOREIGN KEY (tratamentoId) REFERENCES tratamentos(id)
                    )
                `);

                db.run(`
                    CREATE TABLE IF NOT EXISTS estoque (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        nome TEXT NOT NULL,
                        categoria TEXT,
                        quantidade INTEGER NOT NULL DEFAULT 0,
                        limite_minimo INTEGER NOT NULL DEFAULT 5,
                        fornecedor_nome TEXT,
                        fornecedor_telefone TEXT,
                        fornecedor_endereco TEXT,
                        ultima_atualizacao TEXT,
                        notas TEXT
                    )
                `);
                db.run(`
                    CREATE TABLE IF NOT EXISTS estoque_compras (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        itemId INTEGER NOT NULL,
                        data_compra TEXT NOT NULL,
                        quantidade_comprada INTEGER NOT NULL,
                        valor_lote REAL,
                        fornecedor_compra TEXT,
                        FOREIGN KEY (itemId) REFERENCES estoque (id) ON DELETE CASCADE
                    )
                `);

                console.log('Tabelas verificadas/criadas com sucesso.');
            });
        }
    });
}

        function dbAllPromise(sql, params) {
            return new Promise((resolve, reject) => {
                db.all(sql, params, (err, rows) => {
                    if (err) {
                        console.error('Erro DB ALL (Promise):', err.message);
                        reject(err);
                    } else {
                        resolve(rows);
                    }
                });
            });
        }    

        ipcMain.handle('load-main-window', () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) win.loadFile('src/sistema-clinica.html');
        });

        ipcMain.handle('window-minimize', () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) win.minimize();
        });

        ipcMain.handle('window-maximize', () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) {
                if (win.isMaximized()) win.unmaximize();
                else win.maximize();
            }
        });

        ipcMain.handle('window-close', () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) win.close();
        });

        function convertToCSV(data, colunasParaExcluir = []) {
            if (!data || data.length === 0) {
                return ""; 
            }

            const headers = Object.keys(data[0]).filter(h => !colunasParaExcluir.includes(h));
            
            const escape = (value) => {
                if (value === null || value === undefined) return '';
                let str = String(value);
                if (str.includes(';') || str.includes('"') || str.includes('\n')) {
                    str = '"' + str.replace(/"/g, '""') + '"';
                }
                return str;
            };

            const csvRows = [
                headers.join(';'), 
                ...data.map(row => 
                    headers.map(header => escape(row[header])).join(';') 
                )
            ];

            return '\ufeff' + csvRows.join('\n');
        }

            ipcMain.handle('exportar-backup', async (event) => {
                const win = BrowserWindow.getFocusedWindow();

                const { canceled, filePath } = await dialog.showSaveDialog(win, {
                    title: 'Salvar Backup CSV',
                    buttonLabel: 'Salvar Backup',
                    defaultPath: `backup-clinica-${new Date().toISOString().split('T')[0]}.csv`
                });

                if (canceled || !filePath) {
                    return { success: false, message: 'Exportação cancelada pelo usuário.' };
                }

                const dirPath = path.dirname(filePath);

                try {

                    const pacientes = await dbAllPromise('SELECT * FROM pacientes', []);

                    const consultasSql = `
                        SELECT c.*, p.nome as nome_paciente, p.cpf as cpf_paciente 
                        FROM consultas c
                        LEFT JOIN pacientes p ON c.pacienteId = p.id
                    `;
                    const consultas = await dbAllPromise(consultasSql, []);

                    const anamneseSql = `
                        SELECT a.*, p.nome as nome_paciente, p.cpf as cpf_paciente 
                        FROM anamnese a
                        LEFT JOIN pacientes p ON a.pacienteId = p.id
                    `;
                    const anamneses = await dbAllPromise(anamneseSql, []);

                    const tratamentosSql = `
                        SELECT t.*, p.nome as nome_paciente, p.cpf as cpf_paciente
                        FROM tratamentos t
                        LEFT JOIN pacientes p ON t.pacienteId = p.id
                    `;
                    const tratamentos = await dbAllPromise(tratamentosSql, []);

                    const pagamentosSql = `
                        SELECT pg.*, t.descricao as tratamento_descricao, p.nome as nome_paciente
                        FROM pagamentos pg
                        LEFT JOIN tratamentos t ON pg.tratamentoId = t.id
                        LEFT JOIN pacientes p ON t.pacienteId = p.id
                    `;
                    const pagamentos = await dbAllPromise(pagamentosSql, []);

                    const estoque = await dbAllPromise('SELECT * FROM estoque', []);
                    
                    const comprasSql = `
                        SELECT ec.*, e.nome as nome_item
                        FROM estoque_compras ec
                        LEFT JOIN estoque e ON ec.itemId = e.id
                    `;
                    const estoque_compras = await dbAllPromise(comprasSql, []);

                    fs.writeFileSync(path.join(dirPath, 'pacientes.csv'), convertToCSV(pacientes, ['id']), 'utf-8');
                    fs.writeFileSync(path.join(dirPath, 'consultas.csv'), convertToCSV(consultas, ['id', 'pacienteId']), 'utf-8');
                    fs.writeFileSync(path.join(dirPath, 'anamnese.csv'), convertToCSV(anamneses, ['pacienteId', 'nome', 'cpf', 'data_nascimento', 'endereco', 'cep', 'fone', 'fone_emergencia', 'email', 'falar_com']), 'utf-8');
                    fs.writeFileSync(path.join(dirPath, 'tratamentos.csv'), convertToCSV(tratamentos, ['id', 'pacienteId']), 'utf-8');
                    fs.writeFileSync(path.join(dirPath, 'pagamentos.csv'), convertToCSV(pagamentos, ['id', 'tratamentoId']), 'utf-8');
                    fs.writeFileSync(path.join(dirPath, 'estoque.csv'), convertToCSV(estoque, ['id']), 'utf-8');
                    fs.writeFileSync(path.join(dirPath, 'estoque_compras.csv'), convertToCSV(estoque_compras, ['id', 'itemId']), 'utf-8');
                                
                    console.log('Backup CSV salvo com sucesso em:', dirPath);
                    return { success: true, message: `Backup salvo com sucesso na pasta: ${dirPath}` };

                } catch (err) {
                    console.error('Erro ao gerar backup:', err.message);
                    return { success: false, message: `Erro ao gerar backup: ${err.message}` };
                }
            });

            app.whenReady().then(() => {
                initDatabase(); 
                createWindow(); 

                app.on('activate', () => {
                    if (BrowserWindow.getAllWindows().length === 0) {
                        createWindow();
                    }
                });
            });

            app.on('window-all-closed', () => {
                if (process.platform !== 'darwin') {
                    db.close(); 
                    app.quit();
                }
            });

            ipcMain.handle('db:run', async (event, sql, params) => {
                return new Promise((resolve, reject) => {
                    db.run(sql, params, function (err) {
                        if (err) {
                            console.error('Erro DB RUN:', err.message);
                            reject(err);
                        } else {
                            resolve({ lastID: this.lastID, changes: this.changes });
                        }
                    });
                });
            });

            ipcMain.handle('db:all', async (event, sql, params) => {
                return new Promise((resolve, reject) => {
                    db.all(sql, params, (err, rows) => {
                        if (err) {
                            console.error('Erro DB ALL:', err.message);
                            reject(err);
                        } else {
                            resolve(rows);
                        }
                    });
                });
            });

            ipcMain.handle('print-contract', async (event, dados) => {
                
                const printWindow = new BrowserWindow({
                    show: false,
                    width: 800,
                    height: 600,
                    webPreferences: {

                        contextIsolation: false,
                        nodeIntegration: false
                    }
                });

                await printWindow.loadFile(path.join(__dirname, 'contrato-print.html'));

                const formatarData = (data) => {
                    if (!data) return '';
                    const partes = data.split('-');
                    if (partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`;
                    return data;
                };

                const valorFormatado = new Intl.NumberFormat('pt-BR', { 
                    style: 'currency', 
                    currency: 'BRL' 
                }).format(dados.valor_total);
                
                const dataDoContrato = formatarData(dados.data);
                
                await printWindow.webContents.executeJavaScript(`
                    document.getElementById('paciente-nome').textContent = '${dados.pacienteNome}';
                    document.getElementById('paciente-cpf').textContent = '${dados.pacienteCpf}';
                    document.getElementById('tratamento-descricao').innerHTML = \`${dados.descricao.replace(/\n/g, '<br>')}\`;
                    document.getElementById('tratamento-valor').textContent = 'Valor Total: ${valorFormatado}';
                    
                    // 4. USA A NOVA VARIÁVEL AQUI
                    document.getElementById('data-hoje').textContent = '${dataDoContrato}';
                `, true);

                return new Promise((resolve, reject) => {
                    printWindow.webContents.print({}, (success, errorType) => {
                        if (success) {
                            console.log('Impressão enviada com sucesso.');
                            resolve({ success: true });
                        } else {
                            console.error('Falha na impressão:', errorType);
                            reject(new Error(errorType || 'Falha na impressão'));
                        }
                        printWindow.close();
                    });
                });
            });

                ipcMain.handle('print-anamnese', async (event, dados) => {
                    
                    const printWindow = new BrowserWindow({
                        show: false, 
                        webPreferences: {
                            contextIsolation: false,
                            nodeIntegration: false
                        }
                    });

                    printWindow.loadFile(path.join(__dirname, 'anamnese-print.html'));

                    await new Promise((resolve) => {
                        printWindow.webContents.once('did-finish-load', resolve);
                    });

                    const marcar = (valor) => (valor == 1 ? 'X' : '');
                    const formatarData = (data) => {
                        if (!data) return '';
                        const partes = data.split('-');
                        if (partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`;
                        return data;
                    };

                    const imagePath = path.join(__dirname, 'assets/odontograma.jpg');
                    let imageDataUrl;
                    try {
                        const imageBuffer = fs.readFileSync(imagePath);
                        const imageBase64 = imageBuffer.toString('base64');
                        imageDataUrl = `data:image/jpeg;base64,${imageBase64}`;
                    } catch (err) {
                        console.error('Erro ao ler a imagem do odontograma:', err.message);
                        imageDataUrl = '';
                    }
                    
                    try {
                        await printWindow.webContents.executeJavaScript(`
                            const dados = ${JSON.stringify(dados)};
                            const get = (key) => (dados[key] || '');

                            document.getElementById('paciente-nome').textContent = get('nome');
                            document.getElementById('paciente-cpf').textContent = get('cpf');
                            document.getElementById('paciente-nascimento').textContent = '${formatarData(dados.data_nascimento)}';
                            document.getElementById('paciente-email').textContent = get('email');
                            document.getElementById('paciente-endereco').textContent = get('endereco');
                            document.getElementById('paciente-fone').textContent = get('fone');
                            document.getElementById('paciente-emergencia-fone').textContent = get('fone_emergencia');
                            document.getElementById('paciente-emergencia-nome').textContent = get('falar_com');

                            document.getElementById('tratamento_medico_sim').textContent = '${marcar(dados.tratamento_medico)}';
                            document.getElementById('tratamento_medico_nao').textContent = ''; // <-- MUDANÇA
                            document.getElementById('tratamento_medico_qual').textContent = get('tratamento_medico_qual');

                            document.getElementById('tomando_medicamento_sim').textContent = '${marcar(dados.tomando_medicamento)}';
                            document.getElementById('tomando_medicamento_nao').textContent = ''; // <-- MUDANÇA
                            document.getElementById('tomando_medicamento_qual').textContent = get('tomando_medicamento_qual');
                            
                            document.getElementById('alergia_doenca_sim').textContent = '${marcar(dados.alergia_doenca)}';
                            document.getElementById('alergia_doenca_nao').textContent = ''; // <-- MUDANÇA
                            document.getElementById('alergia_doenca_qual').textContent = get('alergia_doenca_qual');
                            
                            document.getElementById('diabetico_sim').textContent = '${marcar(dados.diabetico)}';
                            document.getElementById('diabetico_nao').textContent = ''; // <-- MUDANÇA
                            
                            document.getElementById('doenca_coracao_sim').textContent = '${marcar(dados.doenca_coracao)}';
                            document.getElementById('doenca_coracao_nao').textContent = ''; // <-- MUDANÇA
                            
                            document.getElementById('hipertenso_sim').textContent = '${marcar(dados.hipertenso)}';
                            document.getElementById('hipertenso_nao').textContent = ''; // <-- MUDANÇA
                            
                            document.getElementById('hemofilico_sim').textContent = '${marcar(dados.hemofilico)}';
                            document.getElementById('hemofilico_nao').textContent = ''; // <-- MUDANÇA
                            
                            document.getElementById('pes_incham_sim').textContent = '${marcar(dados.pes_incham)}';
                            document.getElementById('pes_incham_nao').textContent = ''; // <-- MUDANÇA
                            
                            document.getElementById('tosse_persistente_sim').textContent = '${marcar(dados.tosse_persistente)}';
                            document.getElementById('tosse_persistente_nao').textContent = ''; // <-- MUDANÇA
                            
                            document.getElementById('alergia_anestesia_sim').textContent = '${marcar(dados.alergia_anestesia)}';
                            document.getElementById('alergia_anestesia_nao').textContent = ''; // <-- MUDANÇA
                            document.getElementById('alergia_anestesia_qual').textContent = get('alergia_anestesia_qual');
                            
                            document.getElementById('submetido_anestesia_sim').textContent = '${marcar(dados.submetido_anestesia)}';
                            document.getElementById('submetido_anestesia_nao').textContent = ''; // <-- MUDANÇA
                            
                            document.getElementById('teve_hemorragia_sim').textContent = '${marcar(dados.teve_hemorragia)}';
                            document.getElementById('teve_hemorragia_nao').textContent = ''; // <-- MUDANÇA
                            
                            document.getElementById('tem_vicio_sim').textContent = '${marcar(dados.tem_vicio)}';
                            document.getElementById('tem_vicio_nao').textContent = ''; // <-- MUDANÇA
                            document.getElementById('tem_vicio_qual').textContent = get('tem_vicio_qual');
                            
                            document.getElementById('esta_gravida_sim').textContent = '${marcar(dados.esta_gravida)}';
                            document.getElementById('esta_gravida_nao').textContent = ''; // <-- MUDANÇA
                            
                            document.getElementById('sofre_epilepsia_sim').textContent = '${marcar(dados.sofre_epilepsia)}';
                            document.getElementById('sofre_epilepsia_nao').textContent = ''; // <-- MUDANÇA
                            
                            document.getElementById('algo_a_declarar_sim').textContent = '${marcar(dados.algo_a_declarar)}';
                            document.getElementById('algo_a_declarar_nao').textContent = ''; // <-- MUDANÇA
                            document.getElementById('algo_a_declarar_qual').textContent = get('algo_a_declarar_qual');

                            document.getElementById('odontograma_anotacoes').innerHTML = get('odontograma_anotacoes').replace(/\\n/g, '<br>');
                            document.getElementById('odontograma-imagem-src').src = \`${imageDataUrl}\`;
                        `, true);
                    } catch (jsErr) {
                        console.error('Erro ao executar JavaScript na janela de impressão:', jsErr);
                        printWindow.close();
                        throw jsErr;
                    }

                    return new Promise((resolve, reject) => {
                        printWindow.webContents.print({}, (success, errorType) => {
                            if (success) {
                                console.log('Impressão da anamnese enviada com sucesso.');
                                resolve({ success: true });
                            } else {
                                console.error('Falha na impressão da anamnese:', errorType);
                                reject(new Error(errorType || 'Falha na impressão'));
                            }
                            printWindow.close();
                        });
                    });
                });
