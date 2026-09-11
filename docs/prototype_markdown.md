<!-- Estratto automaticamente da tesi_Pecorella.docx per lavoro su testo, note e fonti. -->

# NutriTrack: un’applicazione web interattiva basata su Intelligenza Artificiale per la gestione alimentare domestica personalizzata

- 1. Introduzione 4

- 1.1 Contesto e motivazione 4

- 1.2 Obiettivi della tesi 4

- 1.3 Contributo del progetto NutriTrack 5

- 2. Related works 7

- 2.1 La gestione alimentare domestica come problema socio-tecnico 7

- 2.2 Spreco alimentare, consapevolezza e inventario domestico 7

- 2.3 Smart kitchen, smart fridge e limiti dell'automazione 8

- 2.4 Food recommender systems e meal planning 10

- 2.5 Agenti conversazionali per nutrizione e gestione alimentare 11

- 2.6 LLM, accuratezza, bias e Retrieval-Augmented Generation 12

- 2.7 Applicazioni commerciali e frammentazione dell’esperienza 14

- 2.8 Privacy, fiducia e sostenibilità dell’interazione 15

- 2.9 Dai gap di ricerca alla progettazione di NutriTrack 16

- 3. Analisi del dominio e requisiti 18

- 3.1 Task analysis e notazione utilizzata 18

- 3.2 Accesso e configurazione 19

- 3.3 Gestione degli alimenti e tracciamento dei valori nutrizionali 20

- 3.4 Pianificazione dei pasti e suggerimento ricette 21

- 3.5 Gestione della spesa 22

- 3.6 Monitoraggio nutrizionale 23

- 3.7 Casi d’uso e scenari d’uso 24

- 3.7.1 Scenario 1: monitoraggio alimentare e salute in età adulta avanzata 25

- 3.7.2 Scenario 2: perdita di peso e pianificazione quotidiana 25

- 3.7.3 Scenario 3: gestione familiare della dispensa e della spesa 26

- 3.8 Requisiti funzionali del sistema 26

- 3.9 Requisiti non funzionali e vincoli 27

- 1. Progettazione dell’interfaccia e del prototipo 30

- 4.1 Nutrition 30

- 4.2 Recipes 31

- 4.3 Grocery 31

- 4.4 Progress 32

- 4.5 Profile 33

- 4.6 Evoluzione dal wireframe alla web app 35

- 2. Implementazione del prototipo 36

- 5.1 Dal wireframe al sistema web integrato 36

- 5.2 Profilo utente e personalizzazione 36

- 5.3 Architettura del database PostgreSQL 37

- 5.4 Backend, autenticazione e stato applicativo 40

- 5.5 Modulo Ricette e assistente basato su IA 40

- 5.6 Dispensa, spesa e Open Food Facts 41

- 5.7 Monitoraggio dieta, progressi e dispositivi 42

- 5.8 Deploy, verifiche e stato della web app 42

- 3. Dataset, Retrieval-Augmented Generation e prompting 44

- 6.1 Ruolo delle fonti dati nel prototipo 44

- 6.2 Open Food Facts: prodotti confezionati e barcode 44

- 6.3 FoodData Central: alimenti generici e riferimenti nutrizionali 45

- 6.4 Compendium of Physical Activities e valori MET 46

- 6.5 Dataset considerati e scelte di delimitazione 47

- 6.6 Dal dataset al contesto aumentato 47

- 6.7 Prompt engineering per ricette, pasti e immagini 48

- 6.8 Output strutturati, normalizzazione e fallback 49

- 6.9 Limiti e sviluppi futuri 49

- 7. Valutazione dell’usabilità 51

- 7.1 Obiettivo della valutazione 51

- 7.2 Partecipanti 51

- 7.3 Disegno dello studio 52

- 7.4 Strumenti di valutazione 53

- 7.5 Questionario preliminare 54

- 7.6 Questionario finale 55

- 7.7 Analisi dei dati 57

- 7.8 Discussione attesa 58

- 7.9 Limiti della valutazione 58

- 8. Conclusioni e sviluppi futuri 60

- 9. Bibliografia 61

- 10. Sitografia 65

## Introduzione

### Contesto e motivazione

Gestire il cibo in ambito domestico si presenta come una sfida complessa, che intreccia le abitudini quotidiane degli utenti con le tecnologie utilizzate, ponendo grande enfasi sui processi decisionali e cognitivi individuali. Nonostante l’esistenza di numerose applicazioni dedicate al tracciamento nutrizionale, alla lista della spesa e alla consultazione di ricette, l’esperienza dell'utente è spesso frammentata: le informazioni vengono distribuite tra strumenti diversi, richiedendo un costante coordinamento manuale.

Un aspetto cruciale della cucina intelligente, o nella gestione digitale di una cucina non IoT, è non solo il monitoraggio delle scorte alimentari, ma anche la coordinazione degli aspetti logistici di una casa, come le scadenze e la pianificazione dei pasti. È fondamentale identificare e sfruttare elementi comportamentali, sanitari, economici e ambientali, consentendo agli utenti di stabilire le proprie priorità con un certo grado di libertà rispetto al sistema utilizzato.

Le routine familiari, le preferenze alimentari, eventuali restrizioni dietetiche o patologie, così come l'ottimizzazione delle spese e la riduzione degli sprechi, sono variabili interconnesse che rendono la cucina uno spazio privilegiato per l'implementazione di soluzioni intelligenti.

In questo contesto si inserisce NutriTrack, un’applicazione web sviluppata inizialmente come prototipo di tesi e successivamente evoluta in un sistema integrato, dotato di un frontend modulare, un backend in Node.js, persistenza dei dati in PostgreSQL, autenticazione, integrazione con Azure OpenAI e recupero dati dal dataset Open Food Facts. Questo progetto considera il cibo non solo come un dato nutrizionale, ma anche come un elemento all’interno di pratiche domestiche, vincoli personali, decisioni quotidiane e dati applicativi persistenti.

### Obiettivi della tesi

Rispetto alle applicazioni tradizionali dedicate al tracciamento nutrizionale o alla gestione della dispensa, NutriTrack si propone di combinare in un unico ambiente dati alimentari, stato domestico, obiettivi personali e supporto conversazionale. L’intento non è semplicemente quello di registrare pasti o prodotti, ma di costruire un sistema in grado di connettere ciò che l’utente possiede, consuma, desidera pianificare e deve monitorare nel tempo. In questa ottica, le fonti di dati esterni assumono un ruolo cruciale nel processo decisionale.

Open Food Facts offre l’opportunità di ottenere informazioni sui prodotti confezionati tramite il codice a barre, mentre FoodData Central fornisce dati nutrizionali per alimenti generici e ingredienti non confezionati. Inoltre, il Compendium of Physical Activities consente di stimare il dispendio energetico associato a varie attività fisiche attraverso valori MET. L’Intelligenza Artificiale opera, quindi, all'interno di un sistema ampio, in cui i dati esterni contribuiscono a rendere le stime più accurate e le raccomandazioni più coerenti.

Gli obiettivi specifici di questa tesi sono i seguenti: analizzare la letteratura e le soluzioni esistenti nel campo delle smart kitchen e dei sistemi di raccomandazione alimentare; individuare i principali gap progettuali; formalizzare i compiti dell’utente; progettare e implementare un’applicazione web funzionante; definire un’architettura di dati persistente; integrare i dataset con Azure OpenAI; e predisporre una pipeline RAG per rendere le risposte dell’assistente più controllabili.

### Contributo del progetto NutriTrack

Il problema che questa tesi affronta può essere riassunto nella progettazione e realizzazione di un’applicazione web in grado di integrare la gestione della dispensa, la pianificazione dei pasti, il supporto alla spesa, il monitoraggio nutrizionale e un’assistenza intelligente. L’obiettivo è quello di ridurre la frammentazione tipica delle applicazioni esistenti, mantenendo al contempo il controllo da parte dell’utente e cercando di alleviare il carico mentale, garantire la persistenza dei dati e assicurare la riproducibilità tecnica.

Il principale contributo di NutriTrack consiste nella fusione di funzioni normalmente separate. Sotto il profilo dell’interazione uomo-computer (HCI), il progetto sottolinea il ruolo cruciale dell'interfaccia come mediatore tra la complessità delle informazioni e le pratiche quotidiane. Per quanto riguarda l'intelligenza artificiale (AI), viene proposto un utilizzo controllato del modello linguistico: l’assistente non è considerato come una fonte autonoma di verità, ma come una piattaforma di interazione basata sul profilo dell’utente, sulla dispensa, sui pasti recenti, sulla ricetta attuale, sui dati del dataset Open Food Facts e sui vincoli specificati.

I capitoli seguenti non si limitano a indicare ciò che è stato implementato, ma spiegano anche i motivi dietro la scelta di determinati strumenti e le varie alternative considerate. Le scelte architetturali sono trattate come momenti decisionali, piuttosto che come meri dettagli di implementazione.

## Related works

### La gestione alimentare domestica come problema socio-tecnico

La gestione del cibo in ambito domestico può essere interpretata come un problema socio-tecnico, perché mette in relazione pratiche quotidiane, decisioni individuali e tecnologie di supporto. Non riguarda soltanto la conservazione materiale degli alimenti, ma anche la capacità dell’utente di ricordare ciò che possiede, pianificare i pasti, controllare le scadenze, ottimizzare la spesa e ridurre gli sprechi, considerando anche le preferenze casalinghe e i vincoli nutrizionali. In questo senso, la cucina domestica è uno spazio in cui dati, oggetti fisici e routine familiari si sovrappongono continuamente.

La letteratura su smart kitchen, recommender systems e conversational agents mostra che il problema non può essere ridotto a una singola funzione applicativa. Monitorare o strutturare una dieta, come anche suggerire una ricetta o fornire indicazioni nutrizionali sono attività diverse, ma nella pratica dell’utente tendono a comparire nello stesso flusso decisionale: una persona può chiedersi cosa cucinare con gli ingredienti già presenti, come consumare un alimento prossimo alla scadenza, quali prodotti acquistare per completare un piano settimanale o come adattare una ricetta a una restrizione alimentare. Il valore di un sistema intelligente dipende quindi dalla sua capacità di coordinare queste dimensioni senza aumentare il carico cognitivo.

Questa prospettiva giustifica una rassegna organizzata non per singole tecnologie isolate, ma per problemi progettuali: inventario e spreco alimentare, automazione nelle smart kitchen, sistemi di raccomandazione per ricette e meal planning, agenti conversazionali, affidabilità dei modelli linguistici, Retrieval-Augmented Generation, applicazioni commerciali e gap ancora aperti. L’obiettivo è costruire un quadro coerente entro cui posizionare il sistema sviluppato nella tesi.

### Spreco alimentare, consapevolezza e inventario domestico

Una delle motivazioni principali per la gestione intelligente del cibo domestico è la riduzione dello spreco alimentare. Diversi studi sottolineano che una quota rilevante dello spreco in ambito domestico non deriva da una reale scarsità di strumenti, ma da una gestione frammentata delle informazioni: gli utenti acquistano più alimenti di quelli che consumano, dimenticano prodotti conservati in frigorifero o in dispensa e non sempre riescono a pianificare i pasti in funzione delle scadenze. Lo spreco è quindi legato anche a memoria, attenzione, pianificazione e disponibilità di informazioni aggiornate.

In questo contesto, Ortiz et al. (2023) propongono un sistema di food inventory management basato su IoT per alimenti deperibili, integrando dispositivi di rilevazione, riconoscimento tramite rete neurale e raccomandazione di ricette. Il sistema mostra come l’inventario possa diventare una base operativa per suggerimenti orientati alla riduzione dello spreco: conoscere quali ingredienti sono disponibili e quali stanno per scadere permette di proporre ricette più pertinenti rispetto alla situazione reale dell’utente. I risultati riportati dagli autori indicano una riduzione dello spreco domestico di circa il 30% e un utilizzo ottimale degli ingredienti nell’81% dei casi.

Il contributo è rilevante perché sposta la raccomandazione da un piano puramente informativo a un piano contestualizzato: non si suggerisce una ricetta genericamente adatta, ma una ricetta compatibile con ciò che l’utente possiede e con la priorità temporale degli alimenti. Allo stesso tempo, il sistema evidenzia un limite ricorrente: l’inventario domestico è difficile da mantenere completamente aggiornato. Alcuni alimenti richiedono input manuale, i dati possono essere incompleti o imprecisi e l’utente deve comunque correggere il sistema quando l’automazione fallisce. La gestione dell’inventario non è quindi soltanto un problema di sensing, ma anche un problema di interazione.

### Smart kitchen, smart fridge e limiti dell'automazione

Una seconda linea di ricerca riguarda le smart kitchen e gli smart fridge, cioè ecosistemi domestici in cui frigoriferi connessi, sensori, sistemi cloud e applicazioni mobili collaborano per monitorare lo stato degli alimenti. Le tecnologie più frequenti includono sensori di peso, RFID, NFC, computer vision e sistemi di riconoscimento automatico del prodotto. Queste soluzioni mirano a ridurre l’input manuale richiesto all’utente e a trasformare la cucina in un ambiente capace di produrre dati utilizzabili per notifiche, raccomandazioni e pianificazione.

La letteratura più recente sulle tecnologie IoT per la smart kitchen conferma il potenziale di questi sistemi nella conservazione, nella preparazione e nell’organizzazione del cibo, ma evidenzia anche criticità tecniche e sociali. I sistemi basati su computer vision possono essere sensibili a illuminazione variabile, packaging simili, occlusioni e disposizione non controllata degli oggetti, di conseguenza sono esposti a margini di errore significativi. Le soluzioni RFID o NFC richiedono invece etichette e infrastrutture specifiche non sempre compatibili con le abitudini di acquisto quotidiane. Inoltre, costi, interoperabilità tra dispositivi e assenza di standard condivisi possono ridurre l’effettiva adottabilità domestica.

Un limite importante è che l’automazione, da sola, non garantisce una buona esperienza utente. Se il sistema rileva dati ma richiede continue correzioni, l’utente può percepirlo come un ulteriore compito domestico invece che come un supporto. Per questo motivo, il valore di una smart kitchen non dipende soltanto dall’accuratezza dei sensori, ma anche dalla capacità di trasformare dati frammentati in informazioni comprensibili e azionabili.

Un contributo vicino a questa prospettiva è NARAI, un prototipo documentato in un repository anonimo, che esplora il supporto al confronto tra prodotti alimentari attraverso visualizzazioni in augmented reality spazialmente persistenti (NARAI, n.d.). Il problema di partenza è la frammentazione delle informazioni: dati rilevanti per valutare e confrontare prodotti alimentari possono essere distribuiti tra packaging fisico, applicazioni mobili e fonti digitali separate, rendendo difficile per l’utente organizzare le informazioni in modo chiaro. Questa mancanza di integrazione può sfavorire l’accesso a scelte più consapevoli e sostenibili.

NARAI affronta tale frammentazione integrando l’informazione digitale nel contesto fisico dell’utente. Il sistema non si limita a “mostrare informazioni sul prodotto”, ma utilizza visualizzazioni AR spazialmente persistenti, cioè informazioni digitali che restano ancorate nello spazio vicino ai prodotti reali. L’interazione prevede uno scan attivato manualmente dall’utente tramite l’applicazione: il prodotto viene acquisito attraverso la camera, riconosciuto come immagine e analizzato attraverso una pipeline che invia i dati a una web API con un prompt strutturato. I prodotti scannerizzati possono poi essere mantenuti in un canvas, secondo la scelta dell’utente, per consentire una comparazione più stabile tra alternative.

Questo esempio è rilevante perché mostra ulteriormente come il problema della gestione alimentare non riguardi soltanto l’automazione della raccolta dati, ma anche la capacità di rendere tali dati confrontabili, situati e utili per la decisione.

Nel progetto proposto, il confronto tra prodotti non avviene attraverso visualizzazioni AR spazialmente persistenti, ma tramite scansione del codice a barre e recupero di dati strutturati da Open Food Facts. I prodotti scansionati vengono associati a informazioni nutrizionali e descrittive, successivamente organizzate nell’interfaccia web per consentire una comparazione tra alternative. L’obiettivo condiviso di ridurre la frammentazione informativa viene perseguito attraverso l’agente conversazionale che integra le informazioni dell’utente, usando recupero contestuale e prompting per trasformare dati eterogenei in raccomandazioni comprensibili e orientate all’azione.

### Food recommender systems e meal planning

I food recommender systems costituiscono una componente centrale per applicazioni che vogliono suggerire ricette, alimenti o piani alimentari. Min, Jiang e Jain (2020) descrivono il dominio della food recommendation come un’area complessa, in cui il suggerimento deve tenere conto non solo delle preferenze dell’utente, ma anche di ingredienti, informazioni nutrizionali, contesto, salute, cultura alimentare e disponibilità dei dati. A differenza di altri domini, come film o prodotti commerciali, il cibo coinvolge scelte quotidiane ripetute e può avere effetti diretti su benessere, salute e sostenibilità.

Dal punto di vista tecnico, i sistemi di raccomandazione alimentare possono basarsi su content-based filtering, collaborative filtering, modelli ibridi, metodi graph-based e approcci context-aware. La revisione sistematica di Bondevik et al. (2024), basata su 67 studi selezionati, evidenzia che molti food recommender systems utilizzano dati provenienti da poche fonti, spesso dataset di ricette, e vengono valutati prevalentemente offline tramite metriche di accuratezza. Gli autori sottolineano inoltre che diversi sistemi ignorano attributi personali dell’utente, riducendo il livello di personalizzazione reale.

Questa osservazione è particolarmente rilevante per il progetto di tesi: un sistema che suggerisce ricette sulla base di un dataset generale può essere utile come motore informativo, ma rischia di produrre raccomandazioni poco situate se non integra inventario, scadenze, preferenze, restrizioni alimentari, tempo disponibile e obiettivi dell’utente. La raccomandazione di una ricetta, infatti, non coincide semplicemente con la selezione del contenuto più simile a una query: richiede un processo di negoziazione tra vincoli materiali e preferenze personali.

Il meal planning amplia ulteriormente il problema. Pianificare i pasti significa distribuire ricette nel tempo, evitare ripetizioni, bilanciare valori nutrizionali, considerare porzioni e riutilizzare ingredienti in modo efficiente. In una prospettiva anti-spreco, il sistema dovrebbe anche dare priorità agli alimenti prossimi alla scadenza e trasformare il piano alimentare in una lista della spesa coerente. Questo passaggio mostra perché inventario e raccomandazione non dovrebbero essere trattati come moduli separati, ma come parti di uno stesso flusso decisionale.

### Agenti conversazionali per nutrizione e gestione alimentare

Gli agenti conversazionali introducono una modalità di interazione innovativa rispetto a moduli, dashboard e filtri. In ambito alimentare, gli utenti spesso formulano richieste che non sono sempre strutturate in modo preciso; ad esempio, possono chiedere informazioni su cosa cucinare con gli ingredienti a disposizione, come sostituire un determinato alimento, come preparare una cena leggera o come pianificare la spesa per i giorni successivi. Un’interfaccia conversazionale è in grado di gestire richieste parziali, ambigue o ripetitive, riducendo così la necessità di spostarsi tra diverse schermate.

La letteratura sui conversational agents destinati a migliorare i comportamenti alimentari mostra risultati promettenti in termini di coinvolgimento, aderenza e personalizzazione, ma evidenzia anche alcune limitazioni metodologiche e progettuali. Amil et al. (2025) osservano che gli agenti conversazionali possono supportare interventi nutrizionali e promuovere stili di vita alimentari più sani, ma la loro efficacia dipende da fattori quali la continuità nell’uso, la qualità dell’interazione, la percezione di competenza e la fiducia dell’utente. Un agente generico, opaco o incapace di giustificare le proprie raccomandazioni rischia di non essere adottato in modo duraturo.

Nel contesto domestico, l’agente conversazionale può essere visto come un intermediario tra l’utente e i sistemi sottostanti, come l’inventario, i dataset nutrizionali, le ricette, il profilo utente e le logiche di raccomandazione. Il suo compito non è solo quello di generare testo, ma anche di tradurre dati strutturati in suggerimenti comprensibili, chiedere chiarimenti quando le informazioni sono incomplete e adattare le raccomandazioni in base al dialogo. In questo senso, la conversazione diventa uno strumento per il controllo e il perfezionamento delle raccomandazioni.

ChatDiet rappresenta un esempio significativo di questa prospettiva. Yang et al. (2024) propongono un framework LLM-augmented per chatbot per la raccomandazione alimentare, evidenziando l’importanza di insieme i principi di personalizzazione, spiegabilità e interattività. L’elemento chiave non è l’utilizzo del modello linguistico come unica fonte di conoscenza, bensì la sua integrazione con modelli e dati capaci di rappresentare sia l’utente che il dominio alimentare. Questo approccio si allinea con l’obiettivo di utilizzare l’agente come un’interfaccia adattiva su un sistema più strutturato.

### LLM, accuratezza, bias e Retrieval-Augmented Generation

L’integrazione dei Large Language Models nei sistemi di raccomandazione introduce nuove opportunità, ma anche nuove criticità. A differenza dei sistemi di raccomandazione tradizionali, un LLM è in grado di interpretare il linguaggio naturale, generare spiegazioni, riformulare alternative e mantenere un dialogo contestuale. Tuttavia, la generazione di contenuti in modo libero può portare a risposte non verificabili, incoerenti o non conformi ai dati disponibili. Questo aspetto è particolarmente delicato nel settore alimentare, poiché una raccomandazione può riguardare allergie, restrizioni dietetiche, obiettivi nutrizionali o informazioni personali sensibili.

Zhang et al. (2023) evidenziano che l’uso degli LLM nei sistemi di raccomandazione richiede particolare attenzione alla fairness; infatti, le raccomandazioni possono variare in base a attributi sensibili o a lievi modifiche nel prompt, riflettendo i bias presenti nei dati di addestramento. Per questo motivo, l’accuratezza non può essere concepita solo come capacità di generare un suggerimento plausibile, ma deve includere anche coerenza, robustezza, tracciabilità, assenza di bias evidenti e capacità di rispettare i vincoli dichiarati dall’utente.

La Retrieval-Augmented Generation offre una potenziale soluzione a parte di queste problematiche. Come discusso da Chen et al. (2024), il recupero di conoscenze esterne consente di integrare nel processo generativo fonti redatte in linguaggio naturale, dati tabellari e knowledge graph. Nel contesto di un’applicazione dedicata al settore alimentare, ciò implica la possibilità di accedere a informazioni riguardanti ingredienti, valori nutrizionali, ricette, date di scadenza e prodotti, provenienti da un database collegato all’applicazione, prima di generare una eventuale risposta conversazionale.

L’approccio adottato non equivale a una pipeline RAG completa basata su embedding vettoriali e indicizzazione semantica. Nel prototipo, infatti, il recupero delle informazioni avviene attraverso lookup applicativi, cache, ricerca testuale e selezione contestuale dei dati rilevanti. Tuttavia, il principio progettuale è affine alla logica della Retrieval-Augmented Generation: ridurre l’opacità della generazione linguistica fornendo al modello un contesto esterno, strutturato e controllabile. Questa distinzione è importante per descrivere il progetto in modo tecnicamente preciso.

La pipeline implementata nel prototipo può essere descritta in cinque passaggi: acquisizione dei dati da fonti alimentari esterne e dallo stato utente; normalizzazione dei record in un formato coerente; costruzione di una query di retrieval a partire dal messaggio e dal contesto; selezione dei prodotti più pertinenti; generazione della risposta finale tramite Azure OpenAI usando il blocco recuperato come knowledge base locale.

Rispetto ad altre strategie di adattamento degli LLM, come il fine-tuning, il RAG risulta particolarmente adatto al contesto di questa tesi perché separa la conoscenza utilizzata dal modello dai pesi del modello stesso. Il fine-tuning può essere utile per specializzare il comportamento linguistico del modello, lo stile delle risposte o alcune capacità di classificazione, ma è meno adatto quando il sistema deve operare su dati frequentemente aggiornati, come ricette disponibili, prodotti alimentari, valori nutrizionali, preferenze utente o ingredienti presenti nel database. Ogni aggiornamento rilevante richiederebbe infatti nuovi dati di addestramento, ulteriori costi computazionali e una minore trasparenza sul contenuto effettivamente utilizzato per generare la raccomandazione.

In questo progetto, il RAG non sostituisce il prompting, bensì lo integra. Il prompting viene utilizzato per istruire il modello sul compito da svolgere, sul formato della risposta, sul tono conversazionale e sui vincoli da rispettare. Il RAG, invece, fornisce al modello le informazioni contestuali recuperate da fonti controllabili e aggiornabili. In questo modo, il prompt non contiene soltanto istruzioni generiche, ma include anche dati pertinenti su cui fondare la raccomandazione.

L’approccio, in ogni caso, non elimina automaticamente errori e allucinazioni, perché la qualità dell’output dipende dalla qualità delle fonti, dalla pertinenza del recupero e dal modo in cui il modello integra le informazioni. Tuttavia, è più adatto di una generazione puramente libera quando il sistema deve basarsi su dati aggiornati e controllabili. In questa tesi, può essere posizionato come ponte tra dataset strutturati e interazione naturale: il modello linguistico non inventa il contenuto della raccomandazione, ma lo costruisce a partire da dati recuperati, contestualizzati e organizzati tramite prompting.

Infine, è importante aggiungere che l’applicazione non trasmette all’IA gli identificativi diretti dell’account utente, come nome, cognome, email o user_id. Il backend usa tali dati solo per autenticazione e associazione dei record nel database. All’IA vengono inviati solo i dati funzionali all’elaborazione richiesta, come profilo nutrizionale, preferenze, allergie, pasti, dispensa o contenuto dei file caricati. Tuttavia il dato non può essere considerato pienamente anonimizzato, perché eventuali informazioni identificative presenti nei testi o nei documenti caricati possono comunque essere interpretate dal modello. È più corretto parlare di minimizzazione/pseudonimizzazione dei dati inviati all’IA, non di anonimizzazione assoluta.

### Applicazioni commerciali e frammentazione dell’esperienza

Il panorama commerciale conferma l’esistenza di un bisogno diffuso, ma mostra anche una forte frammentazione delle soluzioni. Le applicazioni di tracking nutrizionale, come MyFitnessPal, Lifesum, YAZIO o Foodvisor, si concentrano su calorie, macronutrienti, obiettivi personali e report. In particolare, Foodvisor propone un’esperienza di monitoraggio supportata da funzionalità di intelligenza artificiale, come il riconoscimento dei pasti tramite fotografia, la scansione dei codici a barre, la registrazione dei pasti e programmi nutrizionali personalizzati. Questo tipo di soluzione riduce parte dell’attrito legato all’inserimento manuale dei dati, ma rimane orientato soprattutto alla misurazione dell’assunzione alimentare e al raggiungimento di obiettivi individuali.

Le applicazioni di scansione prodotto, come Yuka o Edo, permettono invece di valutare qualitativamente un alimento tramite codice a barre e di visualizzare alternative. Altre applicazioni, orientate alla pianificazione dei pasti, alla lista della spesa o alla gestione delle ricette, supportano attività più organizzative. In questa categoria può essere collocata Planter, che si concentra sulla transizione verso un’alimentazione vegetale attraverso menu bilanciati, ricette plant-based, lista della spesa aggiornata e supporto nutrizionale tramite chat. In questo caso il valore principale non è il tracciamento puntuale di ciò che l’utente consuma, ma la guida nella costruzione di abitudini alimentari coerenti con uno specifico modello dietetico.

Queste categorie coprono parti importanti della gestione alimentare, ma raramente le integrano in un flusso unico. Il tracking nutrizionale non comunica necessariamente con l’inventario domestico; la scansione del prodotto non diventa pianificazione dei pasti; la lista della spesa non sempre deriva dalle ricette suggerite, dalle scadenze o dagli alimenti già disponibili. Anche quando alcune applicazioni includono funzioni avanzate, come riconoscimento automatico, ricette personalizzate, piani alimentari o supporto di esperti, l’esperienza rimane spesso organizzata attorno a moduli separati e a un obiettivo dominante: monitorare, valutare, pianificare o acquistare.

Dal punto di vista progettuale, il limite delle applicazioni commerciali non è quindi l’assenza di funzionalità, ma la difficoltà di coordinare dati e decisioni e la tendenza a concentrarsi su una sola porzione del problema. L’utente continua spesso a dover ricostruire mentalmente il collegamento tra ciò che possiede, ciò che deve consumare, ciò che vuole mangiare, ciò che è coerente con i propri vincoli nutrizionali e ciò che deve acquistare. Questo spazio di frammentazione è uno dei punti in cui un agente conversazionale integrato può offrire valore, collegando inventario, preferenze, vincoli, ricette e raccomandazioni in un’interazione più continua.

### Privacy, fiducia e sostenibilità dell’interazione

Oltre all’accuratezza tecnica, la gestione alimentare intelligente solleva questioni di privacy e fiducia. Un sistema avanzato può trattare allergie, preferenze alimentari, peso, abitudini quotidiane, composizione familiare e dati di consumo domestico. Queste informazioni non sono neutre: possono rivelare condizioni sanitarie, vincoli economici, routine e scelte personali. Per questo motivo, un’applicazione alimentare basata su conversational AI non può essere valutata soltanto in termini di funzionalità, ma deve essere progettata come un sistema trasparente, controllabile e comprensibile per l’utente.

Leschanowsky et al. (2024) mostrano, in una revisione sistematica sulla percezione di privacy, sicurezza e fiducia nella conversational AI, che la fiducia non dipende soltanto dalla performance del sistema, ma anche dalla comprensione dei processi, dalla gestione dei dati e dalla percezione di controllo. Nel dominio della gestione alimentare, questi aspetti diventano particolarmente rilevanti perché l’agente può influenzare decisioni quotidiane ripetute e potenzialmente legate a dati sensibili.

Nel progetto, questi aspetti assumono un ruolo centrale perché l’agente conversazionale non genera raccomandazioni in modo isolato, ma utilizza dati recuperati dal contesto applicativo, come inventario, preferenze, vincoli alimentari e ricette. L’approccio RAG contribuisce a rendere più tracciabile la relazione tra dati disponibili e risposta generata, mentre il prompting permette di esplicitare istruzioni, vincoli e formato dell’interazione. Tuttavia, la presenza di dati recuperabili non elimina la necessità di progettare meccanismi di controllo: l’utente deve poter comprendere perché riceve un suggerimento, modificare le proprie preferenze e correggere eventuali informazioni errate o non aggiornate.

Un ulteriore nodo riguarda la sostenibilità dell’interazione. Se il sistema richiede troppi input manuali, notifiche continue o correzioni frequenti, rischia di riprodurre il carico cognitivo che dovrebbe ridurre. Al contrario, un sistema efficiente dovrebbe chiedere informazioni solo quando necessario, rendere visibili le ragioni dei suggerimenti e permettere all’utente di intervenire facilmente su preferenze, vincoli e priorità. In questa prospettiva, l’agente non sostituisce l’utente nelle decisioni alimentari, ma agisce come supporto interpretativo tra dati domestici, raccomandazioni e azione quotidiana.

### Dai gap di ricerca alla progettazione di NutriTrack

Dalle considerazioni emerse nel capitolo, il limite principale delle soluzioni analizzate non riguarda tanto l’assenza di funzionalità, quanto la difficoltà di coordinarle in un’esperienza unitaria. Inventario, ricette, dieta, spesa, scansione dei prodotti e raccomandazioni sono spesso trattati come ambiti separati; inoltre, l’uso di modelli linguistici introduce questioni di affidabilità, trasparenza e controllo dell’utente. NutriTrack si colloca in questo spazio progettuale come applicazione web orientata a collegare dati alimentari, interazione conversazionale e supporto decisionale domestico.

La prima implicazione riguarda l’integrazione tra moduli. Dieta, ricette, dispensa e lista della spesa non devono funzionare come sezioni isolate: un prodotto registrato o scansionato deve poter influenzare le ricette suggerite; una ricetta generata deve poter aggiornare la dieta o indicare ingredienti mancanti; le informazioni recuperate da Open Food Facts devono poter supportare compilazione, confronto e arricchimento dei dati disponibili. Il valore di questo lavoro risiede quindi nel collegamento tra funzioni, più che nella presenza separata di ciascun modulo.

La seconda implicazione riguarda la riduzione del carico cognitivo e manuale. Attività come pianificazione dei pasti, controllo delle scorte, verifica delle scadenze e preparazione della spesa sono spesso frammentate e affidate alla memoria dell’utente. NutriTrack cerca di renderle più sostenibili attraverso modalità di inserimento rapido, come scansione barcode, recupero da Open Food Facts e importazione da immagine o file. Queste funzioni non eliminano la revisione umana, ma spostano l’utente da un ruolo di compilazione completa a uno di verifica, correzione e conferma.

La terza implicazione riguarda il rapporto tra interfaccia strutturata e interazione conversazionale. Form, dashboard, liste e viste comparative mantengono un ruolo importante perché offrono controllo, leggibilità e modifica dei dati; l’agente conversazionale interviene invece dove serve flessibilità, ad esempio nella generazione di ricette, nella riformulazione di alternative o nella gestione di richieste parziali e contestuali. In questo modo, il linguaggio naturale non sostituisce l’interfaccia tradizionale, ma la completa.

Un’ulteriore implicazione riguarda la trasparenza dell’automazione. Poiché il sistema tratta dati personali e alimentari potenzialmente sensibili, l’utente deve poter distinguere tra informazioni inserite manualmente, recuperate da fonti esterne e stimate dall’assistente AI. Questa distinzione è necessaria per costruire fiducia, evitare opacità e mantenere agency rispetto alle decisioni supportate dal sistema.

In questa prospettiva, NutriTrack viene trattato come un caso di studio sull’integrazione tra HCI, intelligenza artificiale conversazionale e gestione alimentare domestica. La task analysis e la progettazione traducono il posizionamento teorico in requisiti, flussi d’interazione, architettura, API, schema dati e piano di valutazione.

## Analisi del dominio e requisiti

### Task analysis e notazione utilizzata

La progettazione del lavoro è supportata da una task analysis, finalizzata a scomporre in maniera sistematica le attività che l’utente deve svolgere per gestire la propria alimentazione domestica attraverso il sistema. Tale analisi è stata formalizzata mediante la notazione ConcurTaskTrees (CTT), che consente di rappresentare sia la struttura gerarchica dei task sia la loro natura operativa.

In particolare, i task sono stati classificati secondo quattro categorie:

- User task, che rappresentano le decisioni e le valutazioni cognitive dell’utente;

- Interaction task, che descrivono le azioni compiute sull’interfaccia;

- Application task, che includono le elaborazioni automatiche del sistema e le funzionalità basate su intelligenza artificiale;

- Abstraction task, utilizzati per organizzare gerarchicamente le attività senza rappresentare azioni esecutive dirette.

Inoltre, gli operatori temporali vengono classificati come segue:

- Sequenzialità: T1 >> T2 or T1 []>> T2

- Disabilitazione: T1 [> T2

- Interruzione: T1 |> T2

- Scelta: T1 [] T2

- Iterazione: T1* or T1{n}

- Concorrenza: T1 ||| T2 e anche T1 |[]| T2

- Opzionalità: [T]

- Ordine indipendente: T1 |=| T2

L’intero modello è organizzato attorno al task principale di livello più alto, “gestire l’alimentazione domestica”, articolato in cinque sotto-task poi ulteriormente sotto-categorizzati: “accesso e configurazione”, “gestione degli alimenti”, “pianificazione dei pasti”, “gestione della spesa” e “monitoraggio nutrizionale”.

La task analysis evidenzia come l’applicazione non si limiti alla registrazione delle informazioni, ma si configuri come un sistema proattivo di supporto decisionale. In particolare, i task di tipo Application – che includono le componenti di intelligenza artificiale – svolgono un ruolo chiave nel ridurre il carico cognitivo dell’utente, automatizzando processi complessi e fornendo suggerimenti personalizzati, pur mantenendo l’utente al centro delle decisioni finali.

### Accesso e configurazione

Il primo sotto-task comprende le operazioni preliminari necessarie all’utilizzo del sistema: si include la creazione dell’account e l’accesso, che permettono l’accesso al profilo utente, a cui si aggiunge il ripristino della password, qualora necessario.

Creazione account (Interaction Task): Inserire email o username |=| Inserire password >> Confermare password >> Accettare termini e condizioni >> Confermare la registrazione.

Creazione account (Application Task): Verifica validità email >> Controllo sicurezza password >> Creazione profilo utente >> Salvataggio dati nel database.

Login (Interaction Task): Inserire credenziali >> Avviare autenticazione [] Recuperare password dimenticata.

Login (Application Task): Verifica credenziali >> Apertura sessione utente [] Autenticazione automatica.

Una volta effettuato l’accesso, l’utente procede all’inserimento dei dati personali e sanitari, tra cui: età, peso, altezza, livello di attività fisica, abitudini alimentari, eventuali allergie o intolleranze, obiettivi nutrizionali.

Inserimento dati personali e sanitari (Interaction Task): Inserimento età |=| Inserimento peso |=| Inserimento altezza |=| Selezione livello di attività fisica |=| Inserimento abitudini alimentari |=| Specificazione allergie/intolleranze |=| Definizione obiettivi nutrizionali.

Inserimento dati personali e sanitari (User Task): Valutazione correttezza dati inseriti >> Selezione obiettivi coerenti con le proprie esigenze.

Inserimento dati personali e sanitari (Application Task): Calcolo metabolismo basale >> Calcolo fabbisogno calorico >> Generazione profilo nutrizionale iniziale >> Personalizzazione parametri IA.

Queste informazioni vengono elaborate automaticamente dal sistema per generare un profilo nutrizionale iniziale, che costituisce la base per tutte le successive elaborazioni dell’intelligenza artificiale, come il calcolo del fabbisogno calorico giornaliero o la personalizzazione delle ricette suggerite.

Rientrano inoltre in questa sezione le impostazioni dell’applicazione, che comprendono la gestione della lingua, la configurazione delle notifiche, le preferenze relative alla privacy, la sincronizzazione cloud e la connessione con servizi esterni, qualora si utilizzino dispositivi terzi connessi all’applicazione.

Configurazione applicazione (Interaction Task): Selezionare lingua |=| Configurare notifiche |=| Gestire impostazioni privacy |=| Attivare sincronizzazione cloud |=| Collegare servizi esterni.

Configurazione applicazione (Application Task): Applicazione preferenze |=| Sincronizzazione dati |=| Gestione autorizzazioni e permessi.

### Gestione degli alimenti e tracciamento dei valori nutrizionali

Il secondo sotto-task riguarda l’acquisizione e la gestione delle informazioni nutrizionali degli alimenti. L’utente può scegliere tra diverse modalità di inserimento: scansione del codice a barre, inserimento manuale oppure riconoscimento tramite IA a partire da immagini.

Task principale: Gestione alimenti (Abstraction Task): Inserimento alimento >> Validazione dati [] Consultazione archivio alimenti.

- Inserimento alimento

Modalità A – Scansione codice a barre:

- Apertura scanner >> Inquadramento codice >> Conferma alimento riconosciuto.

- Application Task: Lettura codice >> Ricerca alimento nel database >> Recupero valori nutrizionali.

Modalità B - Inserimento manuale:

- Inserimento nome alimento |=| Inserimento marca/prodotto |=| Inserimento valori nutrizionali >> Salvataggio alimento.

- User Task: Verifica correttezza dati inseriti.

Modalità C – Riconoscimento tramite IA:

- Application Task: Caricamento/scatto di immagine >> Conferma identificazione alimento >> Analisi immagine >> Riconoscimento alimento >> Estrazione valori nutrizionali stimati.

- Validazione dati

- User Task: Controllo correttezza alimento >> Conferma o modifica valori nutrizionali.

- Application Task: Aggiornamento database personale >> Salvataggio storico alimenti.

- Consultazione archivio alimenti:

- Interaction Task: Ricerca alimento salvato >> Visualizzazione valori nutrizionali >> Modifica o eliminazione alimento.

- Application Task: Recupero dati archivio >> Aggiornamento modifiche.

A seconda della modalità selezionata, il sistema recupera o elabora automaticamente i dati nutrizionali, che vengono poi validati e salvati. In questa fase, le funzionalità di intelligenza artificiale svolgono un ruolo centrale come task di tipo Application, in particolare per il riconoscimento degli alimenti e l’estrazione delle informazioni nutrizionali.

### Pianificazione dei pasti e suggerimento ricette

La terza macro-area supporta l’utente nella scelta dei pasti. Il sistema consente di ottenere suggerimenti di ricette in base a due principali criteri: gli alimenti disponibili (ad esempio quelli presenti in frigorifero) oppure le preferenze espresse dall’utente.

L’intelligenza artificiale analizza i dati disponibili e genera proposte di ricette, che l’utente può valutare e selezionare. A questa funzionalità si affianca la generazione automatica di liste della spesa e ricettari associati, costruiti sulla base delle abitudini alimentari e dei dati nutrizionali.

Task principale: Pianificazione pasti (Abstraction Task): Definizione criteri di ricerca >> Generazione suggerimenti ricette [] Valutazione ricette [] Creazione piano pasti [] Generazione automatica ricette e spesa.

- Definizione criteri di ricerca:

- Interaction Task: Inserimento ingredienti disponibili >> Specifica preferenze alimentari >> Definizione restrizioni nutrizionali.

- User Task: Valutazione disponibilità alimenti >> Specifica preferenze e priorità

- Generazione suggerimenti ricette:

- Application Task: Analisi ingredienti disponibili >> Analisi profilo nutrizionale >> Generazione ricette compatibili >> Ordinamento proposte per priorità nutrizionale

- Valutazione ricette:

- User Task: Consultazione ricette suggerite [] Valutazione ingredienti e valori nutrizionali [] Selezione ricetta desiderata.

- Creazione piano pasti:

- Interaction Task: Assegnamento ricette ai giorni della settimana >> Modifica o sostituzione pasti >> Salvataggio pianificazione.

- Application Task: Aggiornamento bilancio calorico settimanale >> Calcolo valori nutrizionali complessivi.

- Generazione automatica ricette e spesa:

- Application Task: Creazione ricettario personalizzato >> Generazione lista ingredienti mancanti >> Creazione lista della spesa.

### Gestione della spesa

La quarta macro-area riguarda la pianificazione degli acquisti. L’utente può creare una lista della spesa manuale, inserendo i prodotti desiderati, mentre il sistema fornisce suggerimenti e correzioni automatiche basati sui dati disponibili e sulle abitudini registrate.

Task principale: Gestione spesa (Abstraction Task): Creazione lista della spesa → Suggerimento automatico prodotti → Revisione lista → Gestione acquisti.

- Creazione lista della spesa:

- Interaction Task: Inserire prodotti manualmente >> Definire quantità >> Organizzare prodotti per categoria

- Suggerimento automatico prodotti:

- Application Task: Analisi alimenti mancanti >> Analisi abitudini d’acquisto >> Proposta automatica prodotti

- Revisione lista:

- User Task: Valutazione suggerimenti del sistema >> Accettare/rifiutare prodotti >> Modifica quantità o elementi

- Gestione acquisti:

- Interaction Task: Contrassegna prodotti acquistati >> Eliminazione prodotti non necessari >> Aggiornamento disponibilità dispensa

- Application Task: Aggiornamento inventario alimenti >> Sincronizzazione lista su cloud

Anche in questo caso si osserva una collaborazione tra utente e sistema: l’IA propone, ma l’utente mantiene il controllo finale attraverso la valutazione e la modifica della lista.

### Monitoraggio nutrizionale

La macro-area del monitoraggio non riguarda soltanto le calorie assunte attraverso i pasti, ma anche il rapporto tra alimentazione, obiettivi giornalieri, idratazione, peso e dispendio energetico. Nel prototipo, l’utente può registrare manualmente un’attività fisica oppure selezionarla da un catalogo derivato dal 2024 Compendium of Physical Activities. A partire dal tipo di attività, dalla durata e dal peso corporeo disponibile nel profilo o nel log giornaliero, il sistema produce una stima delle calorie spese.

Dal punto di vista della task analysis, questa funzione introduce un’interazione ibrida: l’utente mantiene il controllo sull’inserimento dell’attività e può correggere il valore calorico, mentre il sistema propone automaticamente una stima iniziale basata sul dataset esterno. Il task di monitoraggio diventa quindi un processo di registrazione assistita, non un calcolo interamente manuale né una valutazione completamente automatica.

Task principale: Monitoraggio nutrizionale (Abstraction Task): Registrazione consumo alimentare >> Analisi nutrizionale >> Valutazione risultati [] Connessione dispositivi esterni [] Gestione promemoria intelligenti.

- Registrazione consumo alimentare:

- Interaction Task: Selezionare alimento consumato >> Inserire quantità >> Registrare pasto.

- Application Task: Calcolo calorie assunte >> Calcolo macronutrienti >> Aggiornamento diario alimentare.

- Analisi nutrizionale:

- Application Task: Calcolo andamento giornaliero >> Calcolo andamento settimanale >> Confronto con obiettivi nutrizionali >> Generazione statistiche.

- Valutazione risultati:

- User Task: Interpretazione grafici e statistiche >> Valutazione progressi >> Eventuale modifica alle abitudini.

- Connessione dispositivi esterni:

- Interaction Task: Collegare smartwatch o app salute >> Autorizzare accesso ai dati.

- Application Task: Importazione dati biometrici >> Sincronizzazione attività fisica >> Aggiornamento consumo calorico.

- Gestione promemoria intelligenti:

- Application Task: Invio notifiche per registrazione pasti [] Invio promemoria idratazione [] Suggerimento automatico per il mantenimento delle abitudini alimentari corrette.

### Casi d’uso e scenari d’uso

Per chiarire il rapporto tra requisiti e realizzazione, il sistema viene descritto attraverso due livelli complementari: i casi d’uso e gli scenari d’uso. I casi d’uso individuano le principali funzioni operative del prototipo, mentre gli scenari d’uso collocano tali funzioni in situazioni concrete, associate a bisogni, vincoli e profili utente differenti. Questa distinzione consente di collegare le scelte implementative non solo alla struttura delle schermate, ma anche a pratiche quotidiane realistiche.

I principali casi d’uso individuati sono:

- Gestione della dispensa, con inserimento, modifica e consultazione degli alimenti disponibili;

- Scansione di prodotti tramite barcode e recupero dati da Open Food Facts;

- Confronto tra prodotti sulla base di informazioni nutrizionali;

- Generazione di ricette a partire da ingredienti disponibili, preferenze e vincoli;

- Aggiornamento della dieta a partire da una ricetta o da un alimento registrato;

- Generazione o modifica della lista della spesa;

- Importazione di prodotti da immagine o file;

- Monitoraggio dei progressi relativi a peso, calorie e macronutrienti;

- Gestione del profilo utente, degli obiettivi e dei vincoli alimentari;

- Accesso autenticato e persistenza dei dati multi-sessione.

A partire da questi casi d’uso, sono stati definiti tre scenari rappresentativi.

#### Scenario 1: monitoraggio alimentare e salute in età adulta avanzata

Il primo scenario riguarda un utente adulto o anziano che utilizza NutriTrack per mantenere maggiore controllo sulle proprie abitudini alimentari. L’utente ha l’esigenza di monitorare alcuni aspetti legati alla salute, come peso, apporto calorico, consumo di grassi o attenzione al colesterolo, e può avere vincoli alimentari indicati dal medico o emersi da analisi recenti. In questo contesto, il sistema non deve limitarsi a proporre ricette genericamente “sane”, ma deve aiutare l’utente a orientarsi tra alimenti disponibili, obiettivi nutrizionali e informazioni comprensibili.

L’utente aggiorna il proprio profilo, inserendo obiettivi, preferenze e condizioni rilevanti. Può registrare alimenti manualmente o tramite barcode, recuperando dati nutrizionali da Open Food Facts. Quando richiede una ricetta o consulta un prodotto, NutriTrack può usare queste informazioni per proporre alternative coerenti con i vincoli dichiarati, rendendo visibile quando un dato è stato recuperato da una fonte esterna o stimato dall’assistente. Lo scenario evidenzia quindi requisiti di chiarezza, trasparenza e controllo: l’utente deve poter verificare le informazioni, correggerle e non percepire il sistema come prescrittivo.

#### Scenario 2: perdita di peso e pianificazione quotidiana

Il secondo scenario riguarda un utente giovane che desidera perdere peso o migliorare la propria alimentazione quotidiana. Il bisogno principale non è solo registrare calorie, ma trasformare obiettivi astratti in scelte pratiche: cosa mangiare oggi, come comporre un pasto equilibrato, quali prodotti evitare o preferire, come non perdere continuità nel tempo.

L’utente definisce obiettivi di peso, calorie e macronutrienti, monitora i pasti e usa l’assistente conversazionale per ottenere suggerimenti rapidi. Può chiedere una ricetta più leggera, un’alternativa con più proteine o una proposta basata sugli ingredienti già disponibili. Il sistema combina dati del profilo, dispensa, storico recente e preferenze per generare risposte contestuali. Allo stesso tempo, dashboard e moduli strutturati permettono di controllare i dati inseriti e monitorare i progressi. Questo scenario mostra il ruolo complementare tra interfaccia tradizionale e dialogo naturale: la prima offre precisione e continuità, il secondo rende più flessibile la pianificazione.

#### Scenario 3: gestione familiare della dispensa e della spesa

Il terzo scenario riguarda un utente che gestisce l’alimentazione di una famiglia o di un nucleo domestico. In questo caso il problema principale è organizzativo: evitare sprechi, ricordare le scadenze, sapere cosa è già disponibile, pianificare pasti compatibili con preferenze diverse e preparare una lista della spesa coerente.

Dopo la spesa, l’utente può scansionare prodotti tramite barcode o importare un’immagine con più alimenti. Il sistema recupera dati da Open Food Facts, propone schede compilate e permette una fase di revisione prima dell’inserimento in dispensa. Durante la settimana, l’utente consulta gli alimenti disponibili e può chiedere ricette che utilizzino prodotti vicini alla scadenza o che richiedano pochi ingredienti aggiuntivi. Quando una ricetta viene scelta, NutriTrack può aiutare a individuare ingredienti mancanti e aggiornare la lista della spesa. Questo scenario evidenzia l’importanza dell’integrazione tra moduli: dispensa, ricette e spesa devono comunicare per ridurre il carico organizzativo dell’utente.

### Requisiti funzionali del sistema

In accordo con la distinzione classica della requirements engineering, i requisiti funzionali descrivono i servizi che il sistema deve fornire, le azioni consentite all’utente, gli input accettati e gli output prodotti. A partire dai casi d’uso e dagli scenari descritti nella sezione precedente, i requisiti funzionali di NutriTrack possono essere organizzati come segue.

| ID | Requisito funzionale |
| --- | --- |
| RF1 | Il sistema deve consentire registrazione, login, logout e accesso a dati persistenti associati all’utente autenticato. |
| RF2 | Il sistema deve permettere la creazione e modifica del profilo utente, includendo parametri personali, obiettivi nutrizionali, preferenze, allergie e vincoli alimentari. |
| RF3 | Il sistema deve consentire la gestione della dispensa tramite inserimento, modifica, eliminazione e ordinamento degli alimenti per quantità, categoria e data di scadenza. |
| RF4 | Il sistema deve distinguere tra prodotti disponibili in dispensa e prodotti presenti nella lista della spesa. |
| RF5 | Il sistema deve consentire la scansione barcode e il recupero dei dati prodotto da Open Food Facts tramite endpoint backend dedicato. |
| RF6 | Il sistema deve normalizzare e memorizzare in cache i dati recuperati da Open Food Facts, rendendoli riutilizzabili nei moduli di diario nutrizionale, spesa, confronto prodotti e assistente conversazionale. |
| RF7 | Il sistema deve supportare l’importazione assistita di prodotti da immagine o file, generando una bozza modificabile prima della conferma. |
| RF8 | Il sistema deve consentire il confronto tra prodotti sulla base di dati strutturati, come calorie, proteine, carboidrati, grassi, zuccheri, fibre e Nutri-Score. |
| RF9 | Il sistema deve generare ricette coerenti con profilo utente, preferenze, obiettivi nutrizionali, ingredienti disponibili e richieste conversazionali. |
| RF10 | Il sistema deve permettere salvataggio, consultazione, modifica e applicazione di una ricetta al diario nutrizionale. |
| RF11 | L’assistente conversazionale deve utilizzare il contesto applicativo disponibile, inclusi profilo, dispensa, ricette recenti, ricetta corrente e record Open Food Facts pertinenti. |
| RF12 | Il sistema deve separare risposte conversazionali e azioni strutturate, in modo che le modifiche allo stato applicativo siano verificabili e controllabili. |
| RF13 | Il sistema deve consentire il monitoraggio di peso, calorie e macronutrienti nel tempo. |
| RF14 | Il sistema deve esporre API per lettura e aggiornamento dello stato applicativo, generazione ricette, chat contestuale, recupero Open Food Facts, gestione della lista spesa e applicazione delle ricette alla dieta. |

Questi requisiti traducono i casi d’uso in funzioni implementabili. In particolare, la scansione barcode, l’importazione assistita e il recupero da Open Food Facts rispondono alla necessità di ridurre il carico manuale; la persistenza dello stato e l’autenticazione permettono l’uso multi-sessione; l’assistente conversazionale e il RAG collegano invece dati applicativi e interazione naturale.

### Requisiti non funzionali e vincoli

I requisiti non funzionali definiscono le proprietà di qualità e i vincoli trasversali che il sistema deve rispettare. In questa sezione vengono considerati in riferimento a categorie consolidate nella qualità software, come usabilità, affidabilità, sicurezza, manutenibilità e portabilità.

| ID | Categoria | Requisito non funzionale |
| --- | --- | --- |
| RNF1 | Usabilità | Le operazioni frequenti, come aggiungere un prodotto, consultare la dispensa, confrontare alimenti o generare una ricetta, devono richiedere pochi passaggi e fornire feedback immediato. |
| RNF2 | Trasparenza | Il sistema deve distinguere tra dati inseriti manualmente, recuperati da Open Food Facts, importati da immagine/file e stimati dall’assistente AI. |
| RNF3 | Controllo utente | Le azioni che modificano dieta, dispensa o lista della spesa devono rimanere confermabili, modificabili o correggibili dall’utente. |
| RNF4 | Affidabilità | Il sistema deve gestire errori, dati mancanti e indisponibilità temporanea di servizi esterni come Azure OpenAI e Open Food Facts. |
| RNF5 | Robustezza dei dati | I dati provenienti da fonti esterne devono essere validati, normalizzati e trattati come potenzialmente incompleti. |
| RNF6 | Sicurezza e privacy | I dati personali e alimentari devono essere associati all’utente autenticato, protetti tramite sessione e non esposti inutilmente al frontend. |
| RNF7 | Portabilità | Il prototipo deve poter essere eseguito sia in ambiente locale sia su server tramite Docker e configurazione tramite variabili d’ambiente. |
| RNF8 | Manutenibilità | Frontend, backend, gestione dello stato, integrazioni esterne e logica conversazionale devono essere organizzati in moduli separati. |
| RNF9 | Tracciabilità progettuale | I requisiti devono essere riconducibili ai casi d’uso e agli scenari utente, così da giustificare le scelte implementative e il piano di valutazione. |

Nel caso di NutriTrack, i requisiti non funzionali assumono particolare rilevanza perché il sistema opera in un dominio sensibile. Le risposte generate dall’assistente devono essere considerate suggerimenti e non prescrizioni nutrizionali o mediche; inoltre, informazioni come peso, abitudini alimentari, allergie e preferenze personali richiedono attenzione alla privacy e alla separazione dei dati per utente. Allo stesso tempo, la dipendenza da servizi esterni impone controlli e fallback, affinché errori di rete, dati incompleti o risposte non disponibili non compromettano l’intero flusso applicativo.

## Progettazione dell’interfaccia e del prototipo

La progettazione grafica preliminare dell’interfaccia è stata realizzata attraverso Figma, mentre la versione implementata ha riorganizzato alcune etichette e flussi per adattarli alla versione web funzionante. Il wireframe ha avuto il ruolo di modello esplorativo; il codice ha poi consolidato la navigazione attorno alle sezioni Home, Ricette, Dispensa, Dieta e Dati, mantenendo la corrispondenza funzionale con Nutrition, Recipes, Grocery, Progress e Profile.

Le figure seguenti sono mantenute nella loro forma originale perché documentano la fase Figma del progetto e rendono visibile l’evoluzione dalla progettazione alla prototipazione web. Le schermate non vanno quindi lette come catture aggiornate dell’applicazione finale, ma come base progettuale da cui sono stati poi raffinati flussi, nomenclatura e architettura implementativa. Nella versione definitiva, l’interfaccia adotta una terminologia più vicina all’uso finale: Ricette, Dispensa, Dieta e Dati, con una Home di sintesi.

### Nutrition

Nel wireframe, la sezione Nutrition [Fig. 1] visualizza l’apporto nutrizionale giornaliero dell’utente e consente l’inserimento manuale dei pasti. Nella web app implementata, questa funzione confluisce nella sezione Dieta, che permette di registrare pasti, acquisire prodotti da barcode e mantenere il collegamento con obiettivi e progressi.

*Fig. 1. Pagina Nutrition*

### Recipes

Nel wireframe, la sezione Recipes [Fig. 2, Fig. 2.1] introduce la generazione di ricette e l'interazione conversazionale. Nella web app implementata questa area diventa Ricette e include generazione guidata, cronologia delle proposte, salvataggio, applicazione della ricetta alla dieta e chat con l'assistente AI; il backend costruisce il contesto usando profilo, obiettivi, dispensa, pasti recenti, prodotti Open Food Facts e ricetta corrente.

*Fig. 2. Pagina Recipes*

*Fig. 2.1. Pagina Recipes*

### Grocery

Nel wireframe, la sezione Grocery [Fig. 3] rappresenta il punto di partenza per la lista della spesa. Nella web app implementata questa area viene inglobata e ampliata in Dispensa, che gestisce sia prodotti da acquistare sia inventario domestico: gli alimenti possono essere inseriti manualmente, recuperati tramite scansione del barcode con lookup Open Food Facts oppure proposti a partire da una foto analizzata dall'AI; prima del salvataggio l'utente può correggere nome, quantità, categoria e scadenza.

*Fig. 3. Pagina Grocery*

### Progress

Nel wireframe, la sezione Progress [Fig. 4] consente di osservare l'andamento nutrizionale su scala settimanale o mensile, includendo calorie, proteine, idratazione e variazioni di peso. Nel progetto attuale questa dimensione è collegata anche all'integrazione device: il provider bilancia permette di registrare o sincronizzare misurazioni come peso, BMI e massa grassa, mantenendo la misura come osservazione tracciabile.

### Profile

Nel wireframe, la sezione Profile [Fig. 5, Fig. 5.1] raccoglie dati personali, fisici e nutrizionali, obiettivi, preferenze dietetiche ed eventuali vincoli medici. Nella web app implementata questa area corrisponde alla sezione Dati e alimenta sia il calcolo dei fabbisogni sia il contesto dell'assistente AI.

*Fig. 5. Pagina Profile*

*Fig. 5.1. Pagina Profile*

### Evoluzione dal wireframe alla web app

Le immagini Figma riportate nelle sezioni precedenti vengono mantenute nella loro forma originaria per documentare la fase di progettazione. Questa scelta è intenzionale: le schermate non coincidono perfettamente con la versione corrente della web app, ma mostrano il punto di partenza da cui il progetto si è evoluto. Nel passaggio da wireframe a prototipo funzionante, infatti, alcune etichette e priorità sono cambiate in seguito alle esigenze emerse durante l’implementazione.

La navigazione del prototipo attuale è organizzata intorno a Home, Ricette, Dispensa, Dieta e Dati. Rispetto alle etichette iniziali, questa struttura rende più esplicita la distinzione tra pianificazione alimentare, gestione dei prodotti e consultazione delle informazioni personali. La sezione Grocery del wireframe, ad esempio, si è progressivamente avvicinata ad una distinzione più operativa tra lista della spesa e dispensa, poiché il sistema deve sapere quali prodotti sono ancora da acquistare e quali sono già disponibili.

Anche la sezione Recipes si è trasformata. Nel wireframe l’enfasi era posta sulla consultazione di ricette e sul salvataggio di preferiti; nella web app l’elemento centrale diventa l’assistente AI, capace di generare ricette sulla base del contesto utente e di dialogare sulla ricetta corrente. La progettazione iniziale rimane quindi utile per mostrare la direzione dell’interazione, mentre l’implementazione documenta l’aggiunta di logiche conversazionali e azioni strutturate.

La sezione Progress, infine, è stata reinterpretata alla luce della struttura dati del backend. I grafici e i riepiloghi immaginati nella fase Figma sono stati collegati ad un modello più ampio di misurazioni, obiettivi, pasti registrati e possibili provider esterni. Questa evoluzione dimostra come il prototipo non sia una semplice trasposizione visuale del wireframe, ma una progressiva negoziazione tra idea di interfaccia, vincoli tecnici e dati disponibili.

## Implementazione del prototipo

### Dal wireframe al sistema web integrato

Il passaggio dal wireframe dinamico al prototipo funzionante ha trasformato NutriTrack da una simulazione dell’interfaccia a un sistema web integrato, capace di gestire dati persistenti, profili utente, ricette, dispensa, lista della spesa e interazioni basate su Intelligenza Artificiale. Questa evoluzione è rilevante perché sposta il progetto da una semplice applicazione di tracciamento nutrizionale a un ambiente più ampio per la gestione alimentare domestica personalizzata.

Screen home page e navigazione desktop e mobile + accesso e registrazione

Dal punto di vista tecnico, il prototipo è composto da un frontend web in HTML, CSS e JavaScript, da un backend Node.js e da una base dati PostgreSQL. Il backend Node.js rappresenta la componente server dell’applicazione: riceve le richieste provenienti dall’interfaccia web, esegue la logica applicativa, comunica con il database e con i servizi esterni, e restituisce al frontend le risposte necessarie per aggiornare l’interfaccia. Il frontend mantiene quindi la responsabilità dell’interazione con l’utente, mentre il backend centralizza le operazioni più critiche, come autenticazione, persistenza, integrazione con Azure OpenAI, interrogazione di Open Food Facts e FoodData Central e gestione dello stato applicativo. Questa separazione consente di evitare che il browser diventi l’unico luogo in cui risiedono logica e dati, rendendo il sistema più coerente con uno scenario multiutente e con un possibile deploy reale.

L’implementazione mantiene una struttura modulare: le diverse aree dell’applicazione, come profilo, ricette, dispensa, spesa, progressi, autenticazione e dispositivi, sono organizzate in moduli distinti ma collegati da uno stato condiviso. Tale scelta non ha solo valore tecnico, ma riflette la natura del problema affrontato: l’alimentazione domestica non è composta da attività isolate, ma da decisioni interdipendenti. Un alimento presente in dispensa può influenzare una ricetta; una ricetta può aggiornare il diario alimentare; un obiettivo nutrizionale può modificare i suggerimenti generati dal sistema.

### Profilo utente e personalizzazione

Il profilo utente costituisce la base informativa su cui vengono costruite le funzioni personalizzate del prototipo. L’applicazione raccoglie dati personali, preferenze alimentari, obiettivi nutrizionali, eventuali vincoli dietetici e informazioni utili al calcolo del fabbisogno giornaliero. A partire da parametri come età, altezza, peso, genere e livello di attività, il sistema stima il fabbisogno energetico e propone obiettivi relativi a calorie e macronutrienti.

Screen sezione Profilo

Il fabbisogno energetico giornaliero viene stimato attraverso il total daily energy expenditure (TDEE), che è composto dal metabolismo basale o “basal metabolic rate” (BMR), dall’energia consumata quotidianamente o “non-exercise activity thermogenesis” (NEAT), dall’attività fisica programmata e dalle attività quotidiane non sportive o “exercise activity thermogenesis” (EAT) e, infine, dall’effetto termico del cibo o “thermic effect of food” (TEF). Nel calcolo del TDEE attraverso la formula scelta, NEAT ed EAT vanno considerati come aspetti integranti nel calcolo dell’apporto calorico giornaliero (Levine, 2002; Calcagno et al., 2019).

Questa componente non va interpretata come uno strumento clinico o prescrittivo, ma come un supporto alla personalizzazione dell’esperienza. I dati inseriti dall’utente servono a costruire un contesto più aderente alle sue esigenze, così che le ricette, i suggerimenti e il monitoraggio non siano generici, ma collegati al profilo configurato. In questa prospettiva, il profilo non è una semplice pagina di impostazioni, bensì il punto di partenza del modello decisionale dell’applicazione.

La versione attuale del prototipo include anche una forma di importazione assistita di documenti o referti tramite fotografia, PDF o DOCX, pensata per estrarre informazioni rilevanti da file testuali o immagini. Anche in questo caso il sistema non sostituisce la valutazione dell’utente: i dati estratti vengono presentati come bozza modificabile prima del salvataggio. Questo passaggio è importante perché mantiene l’utente al centro del processo e riduce il rischio che informazioni incomplete o interpretate in modo errato vengano integrate automaticamente nello stato personale.

### Architettura del database PostgreSQL

Uno degli aggiornamenti più significativi del prototipo riguarda il passaggio da una gestione locale dello stato a una persistenza strutturata tramite PostgreSQL. Nelle prime fasi di sviluppo, infatti, lo stato dell’applicazione poteva essere rappresentato in modo più semplice e compatto; tuttavia, con l’ampliarsi delle funzionalità, è emersa la necessità di un modello dati più controllabile, interrogabile e adatto all’analisi.

La versione corrente del progetto utilizza quindi PostgreSQL come sorgente primaria per i dati applicativi principali. Lo schema è organizzato in tabelle dedicate alle diverse aree funzionali del sistema: gestione degli utenti e delle sessioni, profilo personale e nutrizionale, diario alimentare, lista della spesa, dispensa, progressi giornalieri, ricette generate o salvate, integrazioni con dispositivi esterni, misurazioni e cache dei prodotti recuperati da Open Food Facts. Questa struttura permette di rappresentare in modo esplicito le relazioni tra utenti, profili, pasti, ricette, alimenti disponibili, prodotti da acquistare e dati provenienti da servizi esterni.

La modellazione del database distingue le entità centrali del dominio da quelle più flessibili. I dati principali sono organizzati in tabelle relazionali, così da poter applicare chiavi esterne, vincoli di integrità e controlli sui valori numerici, ad esempio per evitare quantità nutrizionali negative o dati fisici non plausibili. I campi JSONB vengono invece utilizzati solo per informazioni la cui struttura può variare nel tempo, come payload provenienti da Open Food Facts, ricette generate, metadata associati alle integrazioni esterne o payload delle misurazioni dei dispositivi. Questa separazione riduce il rischio di stati incoerenti e rende il sistema più adatto a evolvere senza perdere leggibilità.

Particolarmente importante è la distinzione tra lista della spesa e dispensa. La prima rappresenta un’intenzione di acquisto, mentre la seconda descrive ciò che l’utente ha effettivamente a disposizione. Questa differenza, apparentemente semplice, è centrale per la logica del progetto: un sistema che suggerisce ricette o organizza pasti deve sapere se un ingrediente è già presente in casa oppure deve ancora essere acquistato. In questo modo la gestione alimentare domestica viene trattata come un processo dinamico, non come una semplice registrazione di alimenti consumati.

| Area | Tabelle | Dati rappresentati |
| --- | --- | --- |
| Utenti e accesso | users, user_sessions | Account, credenziali, stato dell’utente e sessioni di accesso |
| Profilo utente | user_profiles | Dati personali, dati fisici, preferenze alimentari, condizioni dichiarate e obiettivi nutrizionali |
| Diario alimentare | nutrition_meals | Pasti registrati, orario di consumo, valori nutrizionali, fonte dei dati e modalità di inserimento |
| Spesa e dispensa | grocery_items, pantry_items | Prodotti da acquistare o disponibili, quantità, categoria, scadenza, barcode, provenienza e modalità di inserimento |
| Ricette | recipes, saved_recipes | Ricette generate o salvate, ingredienti, istruzioni, valori nutrizionali, tipologia e origine |
| Progressi | progress_logs | Peso, idratazione, calorie/proteine giornaliere, passi, sonno, note e sorgente della misura |
| Dispositivi | device_providers, device_connections, device_connection_permissions, device_sync_runs, device_measurements | Provider disponibili, connessioni utente, permessi, sincronizzazioni e misurazioni importate |
| Dataset esterni | openfoodfacts_products_cache | Cache dei prodotti recuperati da Open Food Facts, valori nutrizionali e payload originale |
| Analisi dell’interazione | user_entry_mode_daily_summary | Riepilogo giornaliero delle modalità di inserimento manuale, assistito da AI o tramite lookup esterno |

Un ulteriore aspetto introdotto per supportare la fase di valutazione riguarda la registrazione della modalità di inserimento dei dati. In particolare, per i pasti, i prodotti in dispensa e la lista della spesa il database distingue tra inserimento manuale, inserimento assistito da AI, lookup esterno e dato generato dal sistema. Questa informazione sarà utile per l’analisi dei test con questionari come NASA-TLX, poiché consente di confrontare il carico percepito dagli utenti con il tipo di interazione effettivamente utilizzato. Ad esempio, sarà possibile osservare se l’utente tende a preferire l’inserimento manuale di un prodotto oppure funzionalità di supporto come il riconoscimento da foto, l’analisi automatica della descrizione di un pasto o la scansione tramite barcode.

### Backend, autenticazione e stato applicativo

Il backend Node.js ha il compito di rendere effettive le operazioni che nel wireframe erano solo simulate. Gestisce le API per la lettura e l’aggiornamento dello stato, l’autenticazione, la generazione di ricette, la chat contestuale, l’applicazione di una ricetta alla dieta, il recupero di prodotti da Open Food Facts e il collegamento con il provider bilancia.

La presenza del backend è necessaria anche per motivi di sicurezza e controllo. Le credenziali, le sessioni e le chiavi dei servizi esterni non vengono gestite direttamente dal frontend; inoltre, le richieste dell’utente possono essere validate e associate al profilo corretto. La modalità autenticata permette di collegare le operazioni a un utente reale, mentre la modalità single-user locale resta utile per sviluppo e test rapidi.

La gestione delle sessioni e delle password è stata implementata evitando alcune semplificazioni tipiche dei prototipi locali: le password non vengono salvate in chiaro, i token sono trattati in forma hashata e il cookie di sessione è configurato con attributi coerenti con il contesto applicativo. Pur non trasformando il prototipo in un prodotto completo dal punto di vista della sicurezza, queste scelte mostrano attenzione verso la natura sensibile dei dati trattati.

### Modulo Ricette e assistente basato su IA

Il modulo Ricette rappresenta una delle parti più caratterizzanti del progetto, perché introduce l’Intelligenza Artificiale non come funzione decorativa, ma come supporto alla decisione alimentare. La generazione delle ricette non dipende soltanto da una richiesta libera dell’utente: il backend costruisce un contesto che include profilo, obiettivi nutrizionali, preferenze, dispensa, ingredienti in scadenza, lista della spesa, pasti recenti e ricette già generate.

Screen generatore ricette

L’assistente conversazionale è quindi progettato come componente contestuale. La sua funzione non è rispondere in modo generico a domande sull’alimentazione, ma aiutare l’utente all’interno dello stato reale dell’applicazione. Questo aspetto distingue NutriTrack da un normale chatbot: le risposte sono collegate ai dati disponibili nel sistema e possono inserirsi in flussi concreti, come modificare una ricetta, usare ingredienti presenti in dispensa, proporre una lista della spesa o applicare una ricetta al diario alimentare.

Screen agente conversazionale

La risposta generata dal modello viene normalizzata dal backend prima di essere mostrata all’utente. Il sistema controlla che siano presenti elementi minimi, come titolo, ingredienti, istruzioni e valori nutrizionali, e prepara una struttura utilizzabile dall’interfaccia. Questo passaggio riduce la dipendenza dall’output libero del modello e consente di integrare la generazione linguistica in un’applicazione con dati strutturati.

### Dispensa, spesa e Open Food Facts

La gestione di dispensa e spesa amplia il progetto oltre il semplice monitoraggio nutrizionale. L’utente può inserire alimenti manualmente, recuperare informazioni tramite codice a barre, confrontare prodotti e importare elementi a partire da immagini. L’integrazione con Open Food Facts consente di associare ai prodotti dati nutrizionali e metadati provenienti da una fonte aperta, rendendo più solido il processo di inserimento rispetto a una compilazione completamente manuale.

Screen sezione Dispensa

Il recupero dei dati da fonti esterne viene trattato con cautela. I prodotti possono essere incompleti, avere valori mancanti o non essere presenti nel database; per questo motivo il sistema normalizza le informazioni e le presenta in forma gestibile dall’utente. Anche l’importazione da immagine segue una logica assistita: il modello può proporre prodotti, quantità o categorie, ma il risultato deve essere revisionato prima di diventare parte stabile della dispensa o della lista della spesa.

Questa scelta è coerente con l’impostazione generale della tesi: l’IA non elimina il controllo umano, ma riduce il carico operativo e cognitivo dell’utente. NutriTrack non decide autonomamente cosa l’utente possiede, mangia o deve comprare; propone invece strutture modificabili che facilitano la gestione quotidiana.

### Monitoraggio dieta, progressi e dispositivi

Il monitoraggio nutrizionale collega i dati inseriti nel diario alimentare con gli obiettivi definiti nel profilo. L’applicazione calcola le calorie totali giornalieri, l’andamento dei macronutrienti, l’idratazione e i progressi nel tempo, offrendo all’utente una rappresentazione sintetica del proprio comportamento alimentare.

Questa funzione non è isolata dal resto del sistema: l’inserimento del pasto può avvenire tramite descrizione testuale, scansione di barcode, caricamento di immagine. Nel caso dell'immagine, l'interfaccia consente di scegliere tra acquisizione da fotocamera e selezione dalla galleria, mantenendo lo stesso flusso di riconoscimento AI. Dopo il riconoscimento, la descrizione prodotta viene inserita nel campo del pasto e può essere verificata dall'utente prima del salvataggio.

Il calcolo delle calorie spese da attività fisica si basa su CSV derivati dal 2024 Adult Compendium of Physical Activities e dal 2024 Older Adult Compendium. Il sistema seleziona automaticamente il dataset in base all’età presente nel profilo: per utenti adulti utilizza i MET standard, mentre per utenti da 60 anni in su utilizza i valori MET60+ e una diversa base di consumo a riposo.

Screen monitoraggio in Profilo

Il prototipo prevede anche un livello dedicato ai dispositivi, attualmente rappresentato da un provider bilancia in modalità mock. Pur essendo ancora una componente dimostrativa, questa architettura permette di separare la logica dei dispositivi dal resto dell’applicazione. In prospettiva, lo stesso livello potrebbe essere sostituito o esteso con provider reali senza modificare radicalmente le altre sezioni.

### Deploy, verifiche e stato della web app

La versione attuale del progetto è pensata per essere eseguita tramite Docker, con un servizio applicativo Node.js e un servizio PostgreSQL. Questa configurazione rende più riproducibile l’ambiente di esecuzione e facilita il deploy su server, mantenendo separate configurazione, codice applicativo e persistenza. Le variabili d’ambiente controllano modalità d’uso, connessione al database, base path, SMTP, provider bilancia e credenziali Azure OpenAI.

Le verifiche tecniche disponibili coprono l’avvio del backend, la consistenza dello stato e la modalità PostgreSQL primaria. Oltre al funzionamento nominale, il prototipo considera anche alcuni scenari di errore, come assenza di credenziali Azure, indisponibilità di dati esterni o payload non validi. Questo aspetto è rilevante perché un sistema basato su servizi esterni deve prevedere risposte controllate anche quando una fonte non è disponibile.

Nel suo stato attuale, NutriTrack va quindi inteso come prototipo funzionale e non come prodotto concluso. Le sue componenti principali sono implementate e integrate, ma alcune funzionalità possono essere ulteriormente consolidate, in particolare il matching automatico tra ingredienti e dispensa, la generazione strutturata della lista della spesa, l’integrazione con dispositivi reali e una valutazione sistematica con utenti. Il valore del prototipo risiede nella dimostrazione di un modello integrato di gestione alimentare domestica, in cui tracciamento nutrizionale, organizzazione della spesa, ricette, dati personali e interazione conversazionale convergono in un unico ambiente centrato sull’utente.

## Dataset, Retrieval-Augmented Generation e prompting

### Ruolo delle fonti dati nel prototipo

NutriTrack integra diverse fonti dati con ruoli complementari. La scelta di utilizzare dataset e API esterne nasce dall’esigenza di ridurre il rischio che l’IA produca stime nutrizionali o suggerimenti alimentari basati soltanto su conoscenza generale. Nel dominio alimentare, infatti, il valore di una raccomandazione dipende dalla sua coerenza con dati concreti: prodotti realmente disponibili, ingredienti inseriti dall’utente, obiettivi personali, valori nutrizionali, attività svolte e storico dei pasti.

Le fonti dati non sostituiscono il modello AI, ne orientano il comportamento. Il modello resta responsabile dell’interpretazione linguistica, della generazione di ricette, della trasformazione di descrizioni libere in dati strutturati e della gestione conversazionale. I dataset, invece, forniscono riferimenti più controllabili: codici a barre, tabelle nutrizionali, valori per quantità standardizzate, categorie alimentari, MET e metadati di provenienza. Questa separazione permette di presentare l’AI come componente di supporto e non come fonte unica di verità.

Nel prototipo sono presenti tre nuclei principali di dati esterni: Open Food Facts per i prodotti confezionati, FoodData Central per alimenti generici e riferimenti nutrizionali, e il Compendium of Physical Activities per la stima del dispendio energetico. A questi si aggiungono i dati applicativi prodotti dall’utente, come profilo, preferenze, dispensa, lista della spesa, pasti registrati, ricette generate, progressi e misurazioni. Il valore del sistema deriva dall’integrazione tra queste informazioni eterogenee.

### Open Food Facts: prodotti confezionati e barcode

Open Food Facts è un database globale, aperto e collaborativo che contiene informazioni su prodotti confezionati provenienti da diversi paesi. Include codici a barre, ingredienti, allergeni, tabelle nutrizionali e indicatori sintetici come il Nutri-Score.

Nel prototipo, il lookup Open Food Facts viene utilizzato nelle sezioni Dispensa e Dieta. Quando l’utente scansiona o inserisce un codice a barre, il sistema recupera le informazioni disponibili, normalizza i campi nutrizionali rilevanti e li usa per compilare prodotti, pasti o confronti. I valori vengono inoltre mantenuti nello stato applicativo come cache, così da poter essere riutilizzati in seguito senza dipendere ogni volta dalla disponibilità immediata dell’API.

L’uso di Open Food Facts presenta comunque alcuni limiti. Essendo una base dati collaborativa, i record possono essere incompleti, aggiornati in modo non uniforme o privi di alcuni nutrienti. Per questo motivo, il sistema non tratta il recupero automatico come dato definitivo: l’utente può correggere le informazioni prima del salvataggio o modificare successivamente i valori registrati. Questa scelta è coerente con l’impostazione generale del progetto, in cui l’automazione propone e l’utente valida.

L’uso del dataset ha il duplice obiettivo di supportare il lookup operativo di barcode, macronutrienti e classificazioni nutrizionali e di normalizzare i prodotti in record riutilizzabili secondo la già discussa pipeline RAG. Nel codice, i record Open Food Facts presenti nello stato vengono trasformati in blocchi testuali indicizzabili e selezionati localmente in base alla richiesta dell’utente, così da ancorare la risposta dell’assistente a dati controllabili.

### FoodData Central: alimenti generici e riferimenti nutrizionali

Il datased di FoodData Central, messo a disposizione dal Dipartimento dell’Agricoltura degli Stati Uniti, fornisce accesso a dati nutrizionali relativi ad alimenti e prodotti alimentari attraverso API. A differenza di Open Food Facts, che risulta particolarmente utile per prodotti confezionati identificabili tramite barcode, FoodData Central è più adatto al recupero di valori nutrizionali per alimenti generici o ingredienti non necessariamente associati a una confezione commerciale.

Nel prototipo, FoodData Central è stato integrato lato backend come fonte di supporto per due flussi: la generazione di ricette e l’analisi dei pasti inseriti liberamente. Quando l’utente descrive un pasto, il sistema prova a scomporre la descrizione in componenti alimentari, normalizza alcune interrogazioni in inglese quando necessario e recupera valori nutrizionali come calorie, proteine, carboidrati e grassi per 100g di prodotto. Se la quantità è espressa in grammi o millilitri, tali valori possono essere scalati rispetto alla porzione indicata.

Nel generatore di ricette, i riferimenti FoodData Central vengono usati come ancoraggio per rendere più plausibili le stime nutrizionali prodotte dal modello. Questo non significa che l’applicazione effettui una validazione nutrizionale completa o clinica della ricetta: le calorie e i macronutrienti restano stime applicative. Tuttavia, la presenza di una fonte dati esterna riduce la probabilità che il modello generi valori arbitrari o incoerenti.

Dal punto di vista dell’interfaccia, questa integrazione non viene presentata come una funzione separata. L’utente visualizza l’operazione come “Analisi AI”, perché il risultato finale deriva comunque dall’interpretazione del modello. FoodData Central agisce come supporto interno alla generazione e non come etichetta comunicativa autonoma. Questa scelta evita di sovraccaricare l’interfaccia con dettagli tecnici, mantenendo però la possibilità di descrivere nella tesi il ruolo metodologico della fonte esterna.

### Compendium of Physical Activities e valori MET

Per la stima del dispendio energetico associato all’attività fisica, NutriTrack utilizza dataset derivati dal 2024 Compendium of Physical Activities. Il Compendium classifica attività diverse attraverso codici e valori MET, cioè metabolic equivalent of task. Il MET esprime il rapporto tra il costo energetico di un’attività e il metabolismo a riposo: un’attività con valore MET più alto richiede un dispendio energetico maggiore rispetto a un’attività sedentaria.

Nel prototipo sono stati predisposti due file CSV: uno derivato dal 2024 Adult Compendium e uno derivato dal 2024 Older Adult Compendium. Il primo contiene le attività per la popolazione adulta e utilizza la base standard di 1 MET pari a 3,5 ml/kg/min di consumo di ossigeno a riposo. Il secondo è dedicato agli utenti anziani e utilizza i valori MET60+ con una base di riposo pari a 2,7 ml/kg/min. La distinzione è rilevante perché il costo energetico relativo delle attività può variare con l'età e con il metabolismo a riposo.

Quando l’utente inserisce un’attività, il sistema cerca nel catalogo CSV le voci più pertinenti rispetto alla descrizione digitata. Dopo la selezione, la stima delle calorie spese viene calcolata combinando MET, durata e peso corporeo. La formula utilizzata è:

kcal = MET x VO2 a riposo x peso corporeo x durata / 200

Il peso viene ricavato dal log giornaliero o, in assenza di un valore specifico, dal profilo utente. L’utente può comunque inserire manualmente le calorie spese o correggere la stima proposta. Anche in questo caso, quindi, il dataset non elimina il ruolo dell’utente, ma riduce il lavoro manuale e fornisce una base più trasparente per il calcolo.

L’integrazione dei MET amplia il perimetro di NutriTrack oltre il solo conteggio delle calorie assunte. Il sistema può infatti mettere in relazione alimentazione, attività fisica e obiettivi giornalieri. La possibilità di scegliere se includere o meno le calorie spese nell’obiettivo calorico residuo permette inoltre di adattare il comportamento dell’app a diverse preferenze di monitoraggio.

### Dataset considerati e scelte di delimitazione

Durante la progettazione sono stati considerati anche dataset orientati alle ricette, come Recipe1M+ o raccolte di ricette e recensioni, come Diet Plan Recommendation e Food.com, disponibili su piattaforme pubbliche. Queste risorse sono rilevanti per sistemi di raccomandazione culinaria perché collegano ingredienti, istruzioni, categorie, immagini e preferenze degli utenti. Tuttavia, nel prototipo attuale non vengono usate come sorgenti operative.

Recipe1M+ è un lavoro di addestramento di una rete neurale volto a insegnarle un incorporamento congiunto di ricette e immagini su un’attività di recupero di immagini-ricette. Si dimostra che la regolarizzazione attraverso l’aggiunta di un obiettivo di classificazione di alto livello migliora le prestazioni di recupero per rivaleggiare con quelle degli esseri umani e consente l’aritmetica del vettore semantico.

La scelta di non integrare direttamente un grande dataset di ricette è legata agli obiettivi del progetto. NutriTrack non mira a costruire un motore di raccomandazione basato su un catalogo statico di ricette, ma un sistema capace di generare proposte situate a partire da dispensa, preferenze, obiettivi e richieste dell'utente. In questo quadro, la generazione AI risulta più adatta a produrre ricette personalizzate e modificabili, mentre i dataset esterni vengono usati soprattutto per ancorare nutrienti, prodotti e stime energetiche.

Recipe1M+ e dataset analoghi possono quindi essere collocati tra gli sviluppi futuri. Una possibile evoluzione consisterebbe nell'indicizzare ricette esistenti, recuperare esempi pertinenti rispetto agli ingredienti disponibili e usare il modello AI per adattarli al profilo utente. Questo rappresenterebbe una pipeline RAG più completa rispetto a quella attualmente implementata, ma richiederebbe una fase ulteriore di pulizia, indicizzazione, valutazione della qualità e gestione delle licenze.

### Dal dataset al contesto aumentato

Il prototipo non utilizza i dataset come archivi isolati, ma li trasforma in contesto operativo per le funzionalità dell'applicazione. Il concetto centrale è quello di contesto aumentato: prima di chiamare il modello AI, il backend raccoglie informazioni pertinenti, le riduce a blocchi comprensibili e le inserisce nel prompt come vincoli o riferimenti. La risposta generata viene quindi prodotta dentro un perimetro informativo più controllato.

Nel caso delle ricette, il contesto può includere la dispensa ordinata per priorità, gli ingredienti con scadenza ravvicinata, la lista della spesa, gli obiettivi nutrizionali, i pasti recenti, le ricette già generate nella sessione e i riferimenti FoodData Central. Questo permette al modello di proporre ricette non solo linguisticamente plausibili, ma anche coerenti con le risorse reali disponibili e con la necessità di evitare ripetizioni.

Nel caso della chat dell’assistente, il contesto comprende profilo, preferenze, obiettivi, dispensa, ricette correnti e dati Open Food Facts già recuperati. L’assistente non deve quindi comportarsi come un chatbot generalista, ma come un componente dell’app che conosce lo stato corrente del sistema. Questa impostazione consente di rispondere a domande come “cosa posso cucinare con quello che ho?” o “come posso modificare questa ricetta?” utilizzando dati applicativi concreti.

Nel caso dell’analisi dei pasti, il contesto può derivare anche da una foto del pasto; in questo caso, l’immagine viene prima trasformata in una descrizione testuale strutturata e poi analizzata nutrizionalmente. La distinzione tra acquisizione da fotocamera e selezione da galleria non modifica la logica AI, ma rende più flessibile il momento di input: l’utente può fotografare il pasto al momento oppure caricare un’immagine già disponibile.

### Prompt engineering per ricette, pasti e immagini

Il prompt engineering è stato usato per rendere prevedibile il comportamento del modello e per ridurre risposte generiche. Nei flussi principali, il prompt non si limita a chiedere una risposta in linguaggio naturale, ma definisce ruolo, vincoli, formato, tono e limiti dell’assistente. Il modello deve rispondere in italiano, usare il contesto applicativo quando disponibile, rispettare allergie e preferenze, evitare raccomandazioni mediche e dichiarare incertezza quando i dati non sono sufficienti.

Per la generazione di ricette, il prompt richiede una singola ricetta concreta, con ingredienti, quantità, istruzioni, durata, porzioni, difficoltà, calorie e macronutrienti. Viene inoltre richiesto di privilegiare gli ingredienti presenti in dispensa, soprattutto quelli con scadenza vicina, e di evitare ricette troppo simili a quelle già generate nella sessione. La risposta viene richiesta in formato JSON, così da poter essere salvata, mostrata nell’interfaccia e applicata successivamente alla dieta.

Per l’analisi dei pasti, il prompt chiede di convertire una descrizione libera in un insieme di componenti alimentari con quantità, calorie, proteine, carboidrati, grassi, confidence e fonte stimata. I riferimenti provenienti da FoodData Central o Open Food Facts vengono usati solo quando pertinenti.

Per le immagini, il modello viene usato in due momenti diversi: riconoscimento visivo e strutturazione testuale. Nel caso della dispensa, una foto di prodotti, spesa o scontrino viene trasformata in una bozza modificabile di elementi da salvare. Nel caso della dieta, una foto del pasto viene trasformata in una descrizione alimentare, poi analizzata dal flusso nutrizionale. Questa separazione aiuta a mantenere più controllabile il processo: prima si interpreta l’immagine, poi si stimano i valori.

### Output strutturati, normalizzazione e fallback

Uno dei problemi principali nell’uso di modelli generativi all’interno di una web app è la trasformazione di risposte linguistiche in dati utilizzabili. Una ricetta scritta come testo libero può essere utile per la lettura, ma non è immediatamente collegabile a dieta, dispensa, storico o salvataggio. Per questo il prototipo richiede, quando possibile, output strutturati in JSON.

La generazione strutturata permette al backend di verificare la presenza dei campi principali, normalizzare valori numerici, controllare liste di ingredienti e istruzioni, e costruire oggetti coerenti con lo stato applicativo. Se il modello restituisce un formato non valido o incompleto, il sistema applica controlli di parsing e fallback. La robustezza non dipende quindi solo dal prompt, ma dalla combinazione tra istruzioni al modello, validazione applicativa e possibilità di correzione da parte dell'utente.

I fallback svolgono una funzione essenziale anche quando una fonte esterna non risponde. Se Open Food Facts non restituisce un prodotto, se FoodData Central non è configurato o se l’IA non produce un output utilizzabile, il sistema deve degradare in modo comprensibile. Ciò significa mantenere l’inserimento manuale, mostrare messaggi chiari e impedire che dati parziali vengano salvati senza controllo. In un prototipo che tratta informazioni nutrizionali e personali, la gestione dell’errore è parte della qualità progettuale.

### Limiti e sviluppi futuri

L’integrazione di dataset e prompt engineering non elimina i limiti dell’Intelligenza Artificiale nel dominio alimentare. Le stime nutrizionali possono restare approssimative, soprattutto quando le quantità sono ambigue, gli alimenti non sono riconoscibili o le informazioni disponibili sono incomplete. Inoltre, le fonti aperte possono contenere record non aggiornati o non uniformi. Per questi motivi, NutriTrack non deve essere presentato come strumento medico o dietetico prescrittivo, ma come supporto alla consapevolezza e alla gestione quotidiana.

Un primo sviluppo futuro riguarda una pipeline RAG completa. I record Open Food Facts, FoodData Central, Compendium e un eventuale dataset di ricette potrebbero essere indicizzati tramite embedding o ricerca full-text, associando a ogni risultato metadati di provenienza, qualità e data di aggiornamento. Il modello riceverebbe così un insieme di documenti recuperati in modo più sistematico, con riferimenti più precisi e valutabili.

Un secondo sviluppo riguarda la validazione nutrizionale. Le ricette generate potrebbero essere ricontrollate attraverso calcoli deterministici sugli ingredienti, invece di affidare interamente la stima finale al modello. Analogamente, l’analisi dei pasti potrebbe distinguere meglio tra valori recuperati da dataset, stime da porzione standard e correzioni manuali dell’utente. Nell’interfaccia, tuttavia, tale complessità dovrebbe essere presentata in modo semplice, mantenendo chiaro che l’utente conserva il controllo finale.

Infine, l’uso dei MET potrebbe essere raffinato attraverso dati provenienti da dispositivi indossabili o provider reali. Il prototipo già prevede una modellazione separata dei dispositivi, ma l’integrazione effettiva con bilance o tracker richiederebbe gestione dei permessi, sincronizzazione sicura, risoluzione dei conflitti e valutazione della qualità del dato. Anche in questo caso, la direzione progettuale rimane la stessa: integrare fonti diverse senza trasformare l’automazione in una decisione opaca.

## Valutazione dell’usabilità

### Obiettivo della valutazione

La valutazione di NutriTrack ha l'obiettivo di verificare se il prototipo sia comprensibile, utilizzabile e percepito come utile da utenti con competenze diverse. Poiché l’applicazione non si limita a una singola funzione, ma integra profilo, dieta, ricette, dispensa, progressi, fonti dati esterne e funzioni basate su Intelligenza Artificiale, la valutazione non può essere ridotta alla sola gradevolezza dell’interfaccia e al suo design. È necessario osservare se l’utente riesce a comprendere la relazione tra le diverse sezioni, se percepisce l’assistente AI come supporto controllabile e se considera accettabile il livello di dati personali richiesti.

La valutazione prevista ha carattere formativo ed esplorativo. Non mira a produrre una generalizzazione statistica sull’efficacia del sistema, ma a individuare problemi di usabilità, ambiguità interpretative e punti di miglioramento del prototipo. Questa impostazione è coerente con la natura del progetto, che si colloca in una fase di sviluppo avanzato ma ancora prototipale. L’obiettivo principale è quindi capire come utenti reali interagiscono con NutriTrack durante un periodo d’uso libero e quali aspetti risultano più chiari, più utili o più problematici.

La scelta di prevedere una settimana di utilizzo tramite link consente di osservare il prototipo in un contesto più vicino all’uso quotidiano rispetto a una singola sessione guidata. Le funzioni di dieta, ricette, spesa e progressi acquistano senso soprattutto se usate in più momenti: inserire un pasto, aggiornare la dispensa, generare una ricetta o registrare attività fisica sono azioni distribuite nel tempo. Per questo motivo, l’uso libero permette di raccogliere impressioni più realistiche sulla continuità dell’esperienza e sul carico richiesto all’utente.

### Partecipanti

Il campione previsto è composto da dieci partecipanti, selezionati in modo intenzionale per rappresentare profili differenti rispetto all'esperienza con strumenti di Intelligenza Artificiale e rispetto alla familiarità con domini vicini al progetto. La composizione del campione non ha finalità rappresentative in senso statistico, ma permette di confrontare reazioni e difficoltà di gruppi con aspettative diverse.

| Profilo partecipante | Numero utenti | Interesse per la valutazione |
| --- | --- | --- |
| Utenti senza esperienza nell’uso di strumenti AI | 2 | Verificare comprensibilità, fiducia iniziale e chiarezza delle funzioni intelligenti |
| Utenti con esperienza nell’uso di strumenti AI | 2 | Valutare aspettative verso l’assistente, qualità percepita delle risposte e controllo dell’automazione |
| Utenti con esperienza in ambito medico | 2 | Osservare attenzione a dati personali, limiti delle raccomandazioni e affidabilità delle stime nutrizionali |
| Utenti con esperienza in ambito sportivo | 4 | Valutare dieta, progressi, attività fisica, stima delle calorie spese e utilità del monitoraggio |

Questa distribuzione consente di mettere alla prova NutriTrack da prospettive diverse. Gli utenti senza esperienza AI possono evidenziare problemi di comprensione e fiducia; gli utenti più abituati all’AI possono valutare meglio pertinenza e limiti dell’assistente; gli utenti con esperienza medica possono essere più sensibili alla distinzione tra supporto informativo e prescrizione; gli utenti con esperienza sportiva possono fornire osservazioni più precise sul monitoraggio nutrizionale, sull’attività fisica e sull’uso dei valori calorici.

I partecipanti saranno identificati nella tesi tramite codici anonimi, ad esempio P1-P10, evitando di riportare nomi, dati sanitari o informazioni riconoscibili. Le categorie di appartenenza saranno usate solo per interpretare eventuali differenze nelle risposte, non per formulare giudizi individuali.

### Disegno dello studio

La valutazione sarà organizzata come studio d’uso remoto e non moderato della durata di una settimana. A ciascun partecipante verrà fornito un link all’applicazione web e una breve consegna iniziale, formulata in modo da non guidare eccessivamente l’interazione. L’utente potrà esplorare liberamente il sistema e provare le funzioni che ritiene più rilevanti rispetto alle proprie abitudini.

Prima dell’uso, i partecipanti compileranno un breve questionario preliminare per raccogliere informazioni di contesto: fascia d’età, familiarità con applicazioni web, uso di app per dieta, spesa o attività fisica, esperienza con strumenti AI e livello di confidenza percepito nell’utilizzo di nuove tecnologie. Questi dati non servono a profilare clinicamente l’utente, ma a interpretare meglio le risposte successive.

Durante la settimana, ai partecipanti verrà chiesto di usare liberamente NutriTrack, provando almeno alcune funzioni rappresentative: compilazione o consultazione del profilo, inserimento di un pasto, generazione di una ricetta, uso della dispensa o della lista della spesa, consultazione dei progressi e, se pertinente, registrazione di un'attività fisica. La richiesta non deve essere troppo rigida, perché l’obiettivo è valutare anche quali funzioni vengono percepite come spontaneamente utili.

Al termine della settimana verrà somministrato un questionario finale. Il questionario combinerà strumenti standardizzati e domande specifiche sul progetto. Questa scelta consente di ottenere dati confrontabili, come il punteggio SUS, ma anche informazioni più aderenti alle caratteristiche di NutriTrack, come fiducia nell’AI, chiarezza della relazione tra sezioni, utilità della personalizzazione e comprensione dei dati nutrizionali.

### Strumenti di valutazione

La valutazione può includere diversi strumenti, ma è opportuno evitare un carico eccessivo per i partecipanti. Nella fase di selezione erano stati considerati SUS, CUQ, NPS o TAM, NASA-TLX e User Engagement Scale. Tutti questi strumenti sono utili, ma somministrarli integralmente dopo una settimana d’uso rischierebbe di rendere il questionario troppo lungo e di ridurre la qualità delle risposte. Per questo motivo, la versione proposta privilegia una combinazione più sostenibile.

Il primo strumento è il System Usability Scale (SUS), composto da dieci affermazioni valutate su scala Likert a cinque punti. Il SUS fornisce un indicatore sintetico dell’usabilità percepita e consente di confrontare il risultato con soglie comunemente usate in letteratura. Il punteggio viene calcolato trasformando le risposte agli item positivi e negativi e riportando il totale su una scala da 0 a 100.

Il secondo nucleo è composto da domande specifiche sull’assistente AI e sulle funzioni intelligenti. In questo caso, invece di usare integralmente il Chatbot Usability Questionnaire, è preferibile selezionare o adattare alcune dimensioni rilevanti per NutriTrack: comprensione delle risposte, utilità dei suggerimenti, coerenza con la richiesta, percezione di controllo, fiducia nelle stime e chiarezza dei limiti. Questa scelta è più adatta al prototipo, perché l’AI non è presente solo come chatbot, ma anche come generatore di ricette, analizzatore di pasti e supporto all’importazione da immagine.

Il terzo nucleo riguarda il carico percepito. Alcune dimensioni del NASA-TLX possono essere utilizzate per valutare quanto l’interazione sia stata mentalmente impegnativa, frustrante o faticosa. Anche in questo caso, per non appesantire la somministrazione, è possibile usare una versione semplificata basata sui sei fattori principali: carico mentale, carico fisico, pressione temporale, prestazione percepita, sforzo e frustrazione.

Infine, possono essere incluse alcune domande aperte. Le risposte libere sono particolarmente importanti in uno studio esplorativo, perché permettono di individuare problemi non previsti dal questionario: funzioni non comprese, passaggi ambigui, timori sulla privacy, aspettative verso l’AI, fiducia nei dati nutrizionali o desiderio di integrazione con dispositivi esterni.

### Questionario preliminare

Il questionario preliminare ha lo scopo di raccogliere informazioni utili a interpretare l’esperienza d’uso. Le domande devono rimanere essenziali e non invasive. È sufficiente raccogliere dati in forma aggregata, evitando informazioni sanitarie dettagliate non necessarie alla valutazione.

Esempi di domande:

| Area | Domanda | Tipo di risposta |
| --- | --- | --- |
| Profilo generale | Fascia d’età | Scelta multipla |
| Tecnologie digitali | Quanto ti senti a tuo agio nell’uso di nuove applicazioni web? | Scala 1-5 |
| AI | Quanto spesso usi strumenti basati su Intelligenza Artificiale? | Mai, raramente, qualche volta, spesso, quotidianamente |
| Alimentazione | Hai mai usato app per dieta, calorie, ricette o lista della spesa? | Sì/no + risposta breve |
| Sport e salute | Usi app o dispositivi per monitorare attività fisica, peso o progressi? | Sì/no + risposta breve |
| Aspettative | Cosa ti aspetteresti da un’app per la gestione alimentare domestica? | Risposta aperta |

Queste informazioni permettono di distinguere, nella discussione dei risultati, se una difficoltà dipende da un problema generale dell'interfaccia o dalla scarsa familiarità dell'utente con una certa categoria di strumenti. Ad esempio, un utente senza esperienza AI potrebbe richiedere più spiegazioni sul ruolo dell'assistente, mentre un utente sportivo potrebbe concentrarsi maggiormente sulla precisione delle calorie e dei progressi.

### Questionario finale

Il questionario finale sarà somministrato dopo la settimana di uso libero. La prima parte può includere gli item SUS nella loro formulazione adattata a NutriTrack. Ogni affermazione viene valutata da 1 a 5, dove 1 indica completo disaccordo e 5 completo accordo.

| N. | Affermazione SUS adattata |
| --- | --- |
| 1 | Penso che mi piacerebbe usare NutriTrack frequentemente. |
| 2 | Ho trovato NutriTrack inutilmente complesso. |
| 3 | Ho trovato NutriTrack facile da usare. |
| 4 | Penso che avrei bisogno dell’aiuto di una persona esperta per usare NutriTrack. |
| 5 | Ho trovato le diverse funzioni di NutriTrack ben integrate tra loro. |
| 6 | Ho trovato troppe incoerenze nel funzionamento di NutriTrack. |
| 7 | Penso che la maggior parte delle persone imparerebbe rapidamente a usare NutriTrack. |
| 8 | Ho trovato NutriTrack macchinoso da usare. |
| 9 | Mi sono sentito sicuro nell’usare NutriTrack. |
| 10 | Ho dovuto imparare molte cose prima di poter usare NutriTrack. |

La seconda parte riguarda, invece, le funzioni specifiche del prototipo. Anche queste affermazioni possono essere valutate sulla scala Likert 1-5.

| Area | Affermazione |
| --- | --- |
| Integrazione | Ho capito la relazione tra profilo, dieta, ricette, dispensa e progressi. |
| Dieta | Inserire un pasto è risultato chiaro. |
| Foto pasto | La possibilità di scegliere tra fotocamera e galleria rende più semplice l’inserimento da immagine. |
| Ricette | Le ricette generate dall’AI mi sono sembrate coerenti con le informazioni inserite. |
| Dispensa | La gestione della dispensa mi è sembrata utile per ridurre dimenticanze o sprechi. |
| Progressi | La sezione Progressi mi ha aiutato a interpretare l’andamento dei dati inseriti. |
| Attività fisica | La stima delle calorie spese tramite attività fisica mi è sembrata comprensibile. |
| Controllo | Ho avuto la sensazione di poter correggere o controllare i dati prodotti automaticamente. |
| Fiducia | Mi sono fidato delle risposte dell’assistente AI, almeno come supporto iniziale. |
| Limiti | Ho capito che le informazioni nutrizionali sono stime e non prescrizioni mediche. |

La terza parte può riprendere in forma sintetica il carico percepito. Per ogni dimensione, il partecipante assegna un punteggio da 1 a 7.

| Dimensione | Domanda |
| --- | --- |
| Carico mentale | Quanto è stato mentalmente impegnativo usare NutriTrack? |
| Carico fisico | Quanto è stato fisicamente faticoso interagire con l’app? |
| Pressione temporale | Quanto ti sei sentito sotto pressione durante l’uso? |
| Prestazione percepita | Quanto pensi di essere riuscito a usare bene l’app? |
| Sforzo | Quanto sforzo hai dovuto fare per ottenere i risultati desiderati? |
| Frustrazione | Quanto ti sei sentito frustrato o irritato durante l’interazione? |

La parte finale deve includere domande aperte. Queste domande sono utili per raccogliere osservazioni non catturate dalle scale numeriche.

- Quale funzione ti è sembrata più utile?

- Quale funzione ti è sembrata meno chiara?

- C’è stato un momento in cui non hai capito cosa fare?

- Hai percepito l’assistente AI come utile, invadente o poco affidabile?

- Ti sei sentito libero di correggere i dati prodotti automaticamente?

- Che cosa cambieresti per rendere l’app più semplice o più utile?

- Useresti un’app di questo tipo nella vita quotidiana? Perché?

### Analisi dei dati

L’analisi dei dati combina risultati quantitativi e qualitativi. I dati quantitativi includeranno il punteggio SUS, le medie delle domande specifiche su NutriTrack e i punteggi relativi al carico percepito. Considerata la dimensione ridotta del campione, tali valori non dovranno essere interpretati come risultati statisticamente generalizzabili, ma come indicatori descrittivi utili a individuare tendenze.

Il punteggio SUS viene calcolato secondo la procedura standard: per gli item dispari si sottrae 1 al valore assegnato dall’utente, mentre per gli item pari si calcola 5 meno il valore assegnato. La somma dei contributi viene moltiplicata per 2,5, ottenendo un punteggio da 0 a 100. Nella discussione, il valore potrà essere confrontato con la soglia indicativa di 68, spesso usata come riferimento per un'usabilità accettabile.

Le domande specifiche saranno analizzate per area funzionale: dieta, ricette, dispensa, progressi, AI, controllo e fiducia. Questo consentirà di distinguere un eventuale problema generale di usabilità da problemi localizzati. Ad esempio, un buon punteggio SUS accompagnato da punteggi bassi sulla fiducia nell’AI indicherebbe un’interfaccia complessivamente utilizzabile, ma una comunicazione ancora insufficiente sul funzionamento delle stime automatiche.

Le risposte aperte saranno analizzate tramite un’analisi tematica. Il processo prevede lettura ripetuta delle risposte, individuazione di codici iniziali, raggruppamento dei codici in temi, revisione dei temi e sintesi finale. I temi attesi potrebbero riguardare chiarezza dell’interfaccia, fiducia nell’AI, utilità della dispensa, comprensione dei dati nutrizionali, controllo dell’utente, privacy e continuità d’uso.

### Discussione attesa

La discussione dei risultati dovrà mettere in relazione i dati raccolti con gli obiettivi progettuali di NutriTrack. Se gli utenti comprenderanno la relazione tra dispensa, dieta, ricette e progressi, questo rafforzerà l’idea che il prototipo riduca la frammentazione tipica delle applicazioni monofunzionali. Se invece emergeranno difficoltà nel capire come le sezioni si influenzano a vicenda, sarà necessario intervenire sulla navigazione, sulle etichette o sui feedback dopo le azioni principali.

Un punto centrale riguarderà la percezione dell’Intelligenza Artificiale. Il progetto non vuole proporre un assistente autonomo che decide per l’utente, ma un supporto che genera bozze, suggerimenti e stime revisionabili. Per questo sarà importante osservare se gli utenti percepiscono di avere controllo sui risultati generati. La fiducia non deve derivare da un'eccessiva sicurezza comunicativa del sistema, ma dalla possibilità di comprendere, correggere e confermare.

La presenza di partecipanti con profili diversi permetterà di arricchire la discussione. Gli utenti senza esperienza AI potranno indicare se il sistema è comprensibile anche senza familiarità con chatbot o strumenti generativi. Gli utenti esperti di AI potranno valutare meglio la qualità percepita delle risposte e la gestione delle ambiguità. Gli utenti con esperienza medica potranno osservare eventuali rischi comunicativi nel modo in cui sono presentate stime e dati personali. Gli utenti sportivi potranno offrire indicazioni sull’utilità del monitoraggio, dei MET e del collegamento tra attività fisica e obiettivi calorici.

### Limiti della valutazione

La valutazione presenta alcune limitazioni. La prima riguarda la dimensione del campione: dieci partecipanti sono adeguati per una valutazione formativa di usabilità, ma non permettono conclusioni statistiche robuste. I risultati dovranno quindi essere presentati come indicazioni progettuali e non come prova definitiva dell’efficacia del sistema.

La seconda limitazione riguarda la durata dello studio. Una settimana consente di osservare un uso più realistico rispetto a una singola sessione, ma resta un periodo breve per valutare cambiamenti nelle abitudini alimentari, riduzione dello spreco o continuità del monitoraggio. Questi aspetti richiederebbero studi longitudinali più lunghi.

La terza limitazione riguarda il contesto remoto e non moderato. L’uso tramite link permette maggiore naturalezza, ma riduce la possibilità di osservare direttamente esitazioni, errori e strategie dell’utente. Per compensare questo limite, il questionario finale dovrà includere domande aperte e, qualora possibile, una breve intervista di approfondimento con alcuni partecipanti.

Infine, la valutazione non costituisce validazione clinica o nutrizionale. I giudizi raccolti riguardano usabilità, comprensione, utilità percepita e fiducia nel sistema. La correttezza delle stime nutrizionali, delle ricette o dei suggerimenti per specifiche condizioni sanitarie richiederebbe una valutazione esperta separata.

## Conclusioni e sviluppi futuri

La valutazione prevista consente di chiudere il percorso progettuale mettendo alla prova NutriTrack con utenti reali. Il prototipo è stato sviluppato per integrare funzioni spesso separate: registrazione dei pasti, gestione della dispensa, generazione di ricette, lista della spesa, progressi, fonti dati esterne e supporto AI. La valutazione serve quindi a verificare se questa integrazione sia effettivamente comprensibile e utile, non soltanto tecnicamente funzionante.

Il contributo principale del progetto consiste nell’aver costruito un ambiente web in cui l’AI non è un elemento isolato, ma opera all’interno di uno stato applicativo persistente e controllabile. Le ricette generate possono essere applicate alla dieta, i prodotti possono essere collegati alla dispensa, i pasti contribuiscono ai progressi e le fonti esterne supportano dati e stime. Questa continuità tra sezioni rappresenta il nucleo dell’artefatto.

Gli sviluppi futuri riguardano soprattutto il consolidamento del sistema. Dal punto di vista tecnico, sarà possibile rafforzare il controllo delle stime nutrizionali, ampliare l’integrazione con fonti dati, migliorare il matching tra ingredienti e dispensa, completare eventuali integrazioni con dispositivi reali e rendere più sistematica la tracciabilità delle azioni AI. Dal punto di vista HCI, sarà importante migliorare i feedback, ridurre i passaggi ambigui e progettare meccanismi di spiegazione più chiari per le funzioni automatiche.

La valutazione con utenti fornirà indicazioni utili per stabilire quali aspetti del prototipo siano già maturi e quali richiedano ulteriore iterazione. In particolare, sarà importante osservare se l’utente percepisce NutriTrack come uno strumento che riduce il carico cognitivo della gestione alimentare domestica, oppure come un sistema ancora troppo complesso. Questa distinzione è centrale per comprendere il valore effettivo dell’applicazione e per orientare gli sviluppi successivi.

## Bibliografia

Amil, S., Gagnon, M.-P., Bédard, A., Da, S. M. A. R., Zavala Mora, D., Drapeau, V., & Desroches, S. (2025). Interactive Conversational Agents to Improve Dietary Behaviors for Health Promotion: Mixed Systematic Review. Journal of Medical Internet Research, 27, e78220–e78220. <https://doi.org/10.2196/78220>

Bhushan, D., & Agrawal, R. (2020). The Internet of Things: Looking beyond the hype. In An Industrial IoT Approach for Pharmaceutical Industry Growth (pp. 231–255). Elsevier. <https://doi.org/10.1016/B978-0-12-821326-1.00008-5>

Casini, L., Contini, C., Romano, C., & Scozzafava, G. (2015). Trends in food consumptions: What is happening to generation X? British Food Journal, 117(2), 705–718. <https://doi.org/10.1108/BFJ-10-2013-0283>

Felicetti, A. M., Volpentesta, A. P., Linzalone, R., & Ammirato, S. (2023). Information Behaviour of Food Consumers: A Systematic Literature Review and a Future Research Agenda. Sustainability, 15(4), 3758. <https://doi.org/10.3390/su15043758>

Goharian, N., Tonellotto, N., He, Y., Lipani, A., McDonald, G., Macdonald, C., & Ounis, I. (A c. Di). (2024). Advances in Information Retrieval: 46th European Conference on Information Retrieval, ECIR 2024, Glasgow, UK, March 24–28, 2024, Proceedings, Part III (Vol. 14610). Springer Nature Switzerland. <https://doi.org/10.1007/978-3-031-56063-7>

Golshany, H., Ni, Y., Yu, Q., & Fan, L. (2025). IoT-enabled smart kitchen technologies and their impact on food storage, preparation, and culinary experiences: A systematic review. Food Research International, 213, 116557. <https://doi.org/10.1016/j.foodres.2025.116557>

Gunge, V. S. (s.d.). Smart Home Automation: A Literature Review. International Journal of Computer Applications.

Herrmann, S. D., Willis, E. A., Ainsworth, B. E., Barreira, T. V., Hastert, M., Kracht, C. L., Schuna Jr., J. M., Cai, Z., Quan, M., Tudor-Locke, C., Whitt-Glover, M. C., & Jacobs Jr., D. R. (2024). 2024 Adult Compendium of Physical Activities: A third update of the energy costs of human activities. _Journal of Sport and Health Science_, _13_(1), 6-12. <https://doi.org/10.1016/j.jshs.2023.10.010>

Min, W., Jiang, S., & Jain, R. (2020). Food Recommendation: Framework, Existing Solutions, and Challenges. IEEE Transactions on Multimedia, 22(10), 2659–2671. <https://doi.org/10.1109/TMM.2019.2958761>

NARAI. (n.d.). Supporting food product comparison through spatially persistent augmented reality visualizations [Repository anonimo]. Anonymous GitHub. <https://anonymous.4open.science/r/NARAI-9B8D/README.md>

Ortiz Kristine Joyce P., Bautista Pocholo Nico P., Dimailig Mark Vincent D., & Llamzon Andrew Christian D. (2023). Recipe Recommendation System Using IoT-Based Food Inventory Management of Perishables for Household Food Waste Reduction. Chemical Engineering Transactions, 106, 361–366. <https://doi.org/10.3303/CET23106061>

Principato, L., Secondi, L., & Pratesi, C. A. (2015). Reducing food waste: An investigation on the behaviour of Italian youths. British Food Journal, 117(2), 731–748. <https://doi.org/10.1108/BFJ-10-2013-0314>

Rayes, A., & Salam, S. (2019). Internet of Things From Hype to Reality: The Road to Digitization. Springer International Publishing. <https://doi.org/10.1007/978-3-319-99516-8>

Sandholm, T., Lee, D., Tegelund, B., Han, S., Shin, B., & Kim, B. (2014). CloudFridge: A Testbed for Smart Fridge Interactions (arXiv:1401.0585). arXiv. <https://doi.org/10.48550/arXiv.1401.0585>

Singh, A. K., Firoz, N., Tripathi, A., Singh, K. K., Choudhary, P., & Vashist, P. C. (2020). Chapter 7—Internet of Things: From hype to reality. In V. E. Balas, V. K. Solanki, & R. Kumar (A c. Di), An Industrial IoT Approach for Pharmaceutical Industry Growth (pp. 191–230). Academic Press. <https://doi.org/10.1016/B978-0-12-821326-1.00007-3>

Sinha, G., Shahi, R., & Shankar, M. (2010). Human Computer Interaction. 2010 3rd International Conference on Emerging Trends in Engineering and Technology, 1–4. <https://doi.org/10.1109/ICETET.2010.85>

Spurlock, K. D., Acun, C., Saka, E., & Nasraoui, O. (2024). ChatGPT for Conversational Recommendation: Refining Recommendations by Reprompting with Feedback (arXiv:2401.03605). arXiv. <https://doi.org/10.48550/arXiv.2401.03605>

Willis, E. A., Herrmann, S. D., Hastert, M., Kracht, C. L., Barreira, T. V., Schuna Jr., J. M., Cai, Z., Quan, M., Conger, S. A., Brown, W. J., & Ainsworth, B. E. (2024). Older Adult Compendium of Physical Activities: Energy costs of human activities in adults aged 60 and older. _Journal of Sport and Health Science_, _13_(1), 13-17. <https://doi.org/10.1016/j.jshs.2023.10.007>

Yang, Z., Khatibi, E., Nagesh, N., Abbasian, M., Azimi, I., Jain, R., & Rahmani, A. M. (2024). ChatDiet: Empowering Personalized Nutrition-Oriented Food Recommender Chatbots through an LLM-Augmented Framework. Smart Health, 32, 100465. <https://doi.org/10.1016/j.smhl.2024.100465>

Zhang, J., Bao, K., Zhang, Y., Wang, W., Feng, F., & He, X. (2023). Is ChatGPT Fair for Recommendation? Evaluating Fairness in Large Language Model Recommendation. Proceedings of the 17th ACM Conference on Recommender Systems, 993–999. <https://doi.org/10.1145/3604915.3608860>

DA AGGIUNGERE SU VALUTAZIONE USABILITÀ

Brooke, J. (1996). SUS: A “quick and dirty” usability scale. In P. W. Jordan, B. Thomas, B. A. Weerdmeester, & I. L. McClelland (A c. Di), Usability Evaluation in Industry (pp. 189-194). Taylor & Francis.

Hart, S. G., & Staveland, L. E. (1988). Development of NASA-TLX (Task Load Index): Results of empirical and theoretical research. In P. A. Hancock & N. Meshkati (A c. Di), Human Mental Workload (pp. 139-183). North-Holland. <https://doi.org/10.1016/S0166-4115(08)62386-9>

Holmes, W., Moorhead, A., Bond, R., Zheng, H., Coates, V., & Mctear, M. (2019). Usability testing of a healthcare chatbot: Can we use conventional methods to assess conversational user interfaces? In Proceedings of the 31st European Conference on Cognitive Ergonomics (pp. 207-214). ACM. <https://doi.org/10.1145/3335082.3335094>

O'Brien, H. L., Cairns, P., & Hall, M. (2018). A practical approach to measuring user engagement with the refined user engagement scale (UES) and new UES short form. International Journal of Human-Computer Studies, 112, 28-39. <https://doi.org/10.1016/j.ijhcs.2018.01.004>

Ulster University. (s.d.). The Chatbot Usability Questionnaire. Consultato il 7 settembre 2026, da <https://www.ulster.ac.uk/research/topic/computer-science/artificial-intelligence/projects/cuq>

## Sitografia

Compendium of Physical Activities. (s.d.). Compendium of Physical Activities: Quantifying Physical Activity Energy Expenditure. Consultato il 7 settembre 2026, da <https://pacompendium.com/>

Compendium of Physical Activities. (s.d.). 2024 Adult Compendium. Consultato il 7 settembre 2026, da <https://pacompendium.com/adult-compendium/>

Compendium of Physical Activities. (s.d.). 2024 Older Adult Compendium. Consultato il 7 settembre 2026, da <https://pacompendium.com/older-adult-compendium/>

Compendium of Physical Activities. (s.d.). Corrected METS - Adults. Consultato il 7 settembre 2026, da <https://pacompendium.com/corrected-mets/>

Open Food Facts. (s.d.). _Introduction to the Open Food Facts API documentation_. Consultato il 7 settembre 2026, da <https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/>

Open Food Facts. (s.d.). Open Food Facts data. Consultato il 7 settembre 2026, da <https://world.openfoodfacts.org/data>

U.S. Department of Agriculture, Agricultural Research Service. (s.d.). FoodData Central API Guide. Consultato il 7 settembre 2026, da <https://fdc.nal.usda.gov/api-guide/>
