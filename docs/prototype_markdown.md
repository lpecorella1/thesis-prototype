**Sistemi intelligenti per la gestione alimentare domestica con ausilio di Intelligenza Artificiale**

**Indice**

[1\. Introduzione 3](#_Toc232430840)

[1.1 La gestione del cibo domestico come problema socio-tecnico 3](#_Toc232430841)

[1.2 In relazione al food wasting 3](#_Toc232430842)

[1.3 In relazione all'accuratezza dei dati (aggiungere approccio RAG) 4](#_Toc232430843)

[2\. Tecnologie esistenti per l'inventario alimentare: _smart kitchen_ e _smart fridge_ 4](#_Toc232430844)

[3\. Recommendation systems per ricette e pianificazione pasti 5](#_Toc232430845)

[4\. L'uso di agenti conversazionali 6](#_Toc232430846)

[4.1 In relazione ai limiti dei sistemi tradizionali 6](#_Toc232430847)

[4.2 In relazione all'integrazione con sistemi di raccomandazione 6](#_Toc232430848)

[4.3 ChatDiet: framework per la gestione alimentare 7](#_Toc232430849)

[5\. Ambienti web commerciali attualmente esistenti 7](#_Toc232430850)

[5.1 Applicazioni per lo stile di vita 7](#_Toc232430851)

[6\. Problematiche aperte nella letteratura 8](#_Toc232430852)

[7\. Gap di ricerca e posizionamento del progetto 8](#_Toc232430853)

[8\. Cosa propongo con questo progetto 9](#_Toc232430854)

[8.1 Gli obiettivi principali 9](#_Toc232430855)

[8.2 Gli obiettivi trasversali 9](#_Toc232430856)

[9\. Task Analysis 10](#_Toc232430857)

[9.1 Notazione utilizzata 10](#_Toc232430858)

[9.2 Accesso e configurazione 11](#_Toc232430859)

[9.3 Gestione degli alimenti e tracciamento dei valori nutrizionali 12](#_Toc232430860)

[9.4 Pianificazione dei pasti e suggerimento ricette 12](#_Toc232430861)

[9.5 Gestione della spesa 13](#_Toc232430862)

[9.6 Monitoraggio nutrizionale 14](#_Toc232430863)

[10\. Progettazione prototipo 15](#_Toc232430864)

[11\. Dataset utilizzati 19](#_Toc232430865)

[12\. Strutturazione del prompt 19](#_Toc232430866)

[13\. Bibliografia 20](#_Toc232430867)

- Introduzione
  - La gestione del cibo domestico come problema socio-tecnico

Gestire il cibo in ambito domestico rappresenta un problema complesso di natura socio-tecnica, che interseca la quotidianità degli utenti con le tecnologie che utilizzano, e in cui i processi decisionali e cognitivi individuali hanno grande rilevanza.

L'aspetto di interesse in una cucina _smart_ o anche nella gestione digitale di una cucina non IoT non è solo di monitorare le scorte alimentari, ma anche di coordinare gli aspetti logistici di una casa, come le scadenze e la pianificazione dei pasti: si tratta di individuare e servirsi di aspetti comportamentali, sanitari, economici e ambientali, con la possibilità da parte dell'utente di stabilire le proprie priorità con un certo livello di libertà rispetto al sistema utilizzato.

A costituire variabili interconnesse che rendono la cucina uno spazio privilegiato per l'applicazione di soluzioni di ambient intelligence ci sono anche le routine familiari, le preferenze alimentari, eventuali restrizioni dietetiche o patologie, l'ottimizzazione della spesa e la riduzione dello spreco.

- 1. In relazione al _food wasting_

Nel contesto della gestione dello spreco alimentare domestico, diversi studi<sup>[\[1\]](#footnote-1)</sup> evidenziano come una delle principali cause del fenomeno sia la mancanza di pianificazione e di consapevolezza nell'utilizzo degli alimenti disponibili, piuttosto che una reale scarsità di risorse. In particolare, Ortiz et al. (2023) evidenziano come gli utenti tendano ad acquistare più cibo di quanto effettivamente consumino e a dimenticare gli ingredienti conservati in frigorifero.

Per affrontare questo problema, lo studio preso in causa propone un sistema integrato basato su tecnologie IoT e algoritmi di raccomandazione, in grado di monitorare automaticamente gli alimenti disponibili e suggerire ricette in funzione della loro disponibilità e prossimità alla scadenza. In questo senso, la raccomandazione non si limita a proporre contenuti pertinenti, ma assume un ruolo strategico nella riduzione dello spreco.

I risultati dello studio dimostrano un impatto significativo, con una riduzione dello spreco alimentare domestico di circa il 30% e un utilizzo ottimale degli ingredienti nell'81% dei casi. Tuttavia, l'interazione con il sistema rimane vincolata a un'interfaccia tradizionale, che richiede all'utente un coinvolgimento attivo e strutturato: in questo contesto inserisco il mio lavoro, con l'obiettivo di estendere questi approcci attraverso l'integrazione di un agente conversazionale capace di supportare l'utente in modo più naturale e proattivo nella gestione del cibo domestico, trasformando la raccomandazione da strumento passivo a processo dialogico e adattivo.

Un ulteriore contributo nel campo della gestione intelligente del cibo domestico è rappresentato dai sistemi di raccomandazione ibridi orientati al _meal planning_, che combinano tecniche di _content-based_ e _collaborative filtering_ per fornire suggerimenti personalizzati. In questo ambito, la raccomandazione non si limita alla selezione di singole ricette, ma si estende alla pianificazione complessiva dei pasti e all'ottimizzazione della spesa alimentare, introducendo una dimensione sistemica nella riduzione dello spreco<sup>[\[2\]](#footnote-2)</sup>.

- 1. In relazione all'accuratezza dei dati (aggiungere approccio RAG)

Nei sistemi di raccomandazione basati su Large Language Models (LLM), l'accuratezza dei risultati non può essere interpretata esclusivamente nei termini tradizionali di precisione predittiva, poiché il paradigma generativo introduce nuove criticità legate alla natura stessa dei dati e delle modalità di output. A differenza dei _recommender systems_ classici, infatti, i modelli RecLLM producono raccomandazioni attraverso generazione linguistica libera, senza fare riferimento a un insieme fisso di candidati né a punteggi espliciti, rendendo complessa una valutazione oggettiva delle performance.

Come evidenziato da Zhang et al. (2023), le metriche standard risultano inadeguate in questo contesto e a questa difficoltà metodologica si aggiunge il problema legato alla qualità dei dati: gli LLM sono addestrati su grandi corpora eterogenei che includono anche bias sociali e culturali, influenzando così in modo diretto la generazione delle raccomandazioni. In questo senso, l'accuratezza non dipende soltanto dalla capacità del modello di cogliere le preferenze dell'utente, ma anche dalla rappresentatività e neutralità dei dati sottostanti - obiettivi difficili da raggiungere.

Si osserva anche che i sistemi LLM tendono a rinforzare i bias sociali nella generazione degli output, evidenziando come le distorsioni possano compromettere l'affidabilità del sistema e produrre risultati incoerenti o non equi. I risultati sperimentali mostrano, ancora, che le raccomandazioni generate variano significativamente al variare di attributi sensibili o anche in presenza di piccole perturbazioni linguistiche, indicando una scarsa stabilità dell'output e quindi una forma di inaccuratezza sistemica.

In questo scenario, emerge la necessità di ridefinire il concetto stesso di accuratezza nei sistemi basati su LLM, integrandolo con dimensioni quali la coerenza, la robustezza e l'assenza di bias, e adottando metriche alternative basate sulla similarità e sulla consistenza delle raccomandazioni.

- Tecnologie esistenti per l'inventario alimentare: _smart kitchen_ e _smart fridge_

Una prima linea di ricerca nell'ambito della gestione alimentare domestica riguarda lo sviluppo di cucine intelligenti, intese come ecosistemi smart che integrano frigoriferi connessi e altri elettrodomestici basati su tecnologie IoT. In tale contesto, si è esplorato l'impiego di sensori di peso, tecnologie RFID e NFC, sistemi di computer vision e piattaforme cloud al fine di automatizzare il monitoraggio delle scorte alimentari<sup>[\[3\]](#footnote-3)</sup>.

Queste soluzioni dimostrano la fattibilità tecnica di sistemi di inventario automatizzato, in grado di rilevare la presenza degli alimenti e, in alcuni casi, di identificarne la tipologia attraverso tecniche di riconoscimento visivo. Tuttavia, l'implementazione concreta di tali sistemi evidenzia alcune criticità: in particolare, il riconoscimento accurato degli alimenti tramite computer vision presenta margini di errore significativi, soprattutto in ambienti domestici non controllati, caratterizzati da condizioni di illuminazione variabili e dalla possibile sovrapposizione di oggetti.

Analogamente, i sistemi basati su RFID richiedono l'applicazione preventiva di etichette specifiche, non sempre compatibili con la filiera commerciale e con le pratiche quotidiane degli utenti. Inoltre, l'utente è spesso chiamato a intervenire manualmente per correggere o integrare i dati, riducendo il valore percepito dell'automazione e introducendo una frizione nell'interazione con il sistema. A tali limiti si aggiungono gli elevati costi di produzione, sviluppo e installazione, nonché le difficoltà di interoperabilità con ecosistemi di _smart home_ eterogenei e la generale mancanza di standard condivisi nel dominio della domotica. Nel complesso, sebbene queste soluzioni evidenzino il potenziale delle tecnologie IoT nella gestione automatizzata delle scorte alimentari, esse mostrano anche la necessità di approcci complementari.

- Recommendation systems per ricette e pianificazione pasti

Parallelamente, una seconda linea di ricerca riguarda i già nominati _recipe recommender systems_, che suggeriscono ricette sulla base degli ingredienti disponibili, delle preferenze dell'utente, di vincoli dietetici o di obiettivi nutrizionali.

Dal punto di vista tecnico, questi sistemi si basano su approcci consolidati quali il content-based filtering, il collaborative filtering, ma anche su modelli ibridi e recommendation context-aware, che permette di integrare più informazioni e gestire dati complessi.

- L'uso di agenti conversazionali
  - In relazione ai limiti dei sistemi tradizionali

Un limite importante che emerge dagli studi in letteratura è che molti sistemi risultano essere statici o poco conversazionali<sup>[\[4\]](#footnote-4)</sup>, laddove l'interazione avviene tramite form e selezioni, anziché tramite dialogo naturale: per migliorare l'interazione si considera l'uso di agenti conversazionali, concepiti come intermediario tra l'eventuale infrastruttura IoT domestica e la richiesta di un input conversazionale che permetta un adeguato livello di controllo dei contenuti da parte dell'utente e al tempo stesso di alleggerire il carico domestico. In ogni caso, l'uso di agenti conversazionali LLM non risulta essere una soluzione priva di problematiche: un primo problema riguarda l'accuratezza dei dati, di cui si è detto, ma seguono anche la gestione della privacy, il mantenimento di un buon engagement e la sostenibilità come elementi da tenere in considerazione nello sviluppo del prodotto.

- 1. In relazione all'integrazione con sistemi di raccomandazione

Un agente conversazionale basato su LLM può integrare e potenziare i sistemi di raccomandazione tradizionali, assumendo il ruolo di interfaccia intelligente tra l'utente e gli algoritmi di suggerimento, in un approccio ibrido. In tale configurazione, il _recommendation system_ continua a svolgere la funzione di elaborazione dei dati strutturati e generazione di suggerimenti, mentre l'agente LLM si occupa di interpretare il contesto, gestire l'interazione in linguaggio naturale e adattare dinamicamente le raccomandazioni alle esigenze dell'utente.

Negli ultimi anni si è assistito a una crescente attenzione verso l'impiego di agenti conversazionali per promuovere comportamenti alimentari più sani. La già citata review di Amil et al. evidenzia come tali sistemi possano aumentare l'engagement e favorire l'adesione a programmi nutrizionali, soprattutto quando offrono un elevato grado di personalizzazione. La percezione di competenza dell'agente e la trasparenza dei meccanismi decisionali emergono come fattori determinanti per la costruzione della fiducia.

La maggior parte dei sistemi analizzati in letteratura si concentra prevalentemente sulla promozione della salute individuale e sul coaching nutrizionale, senza integrare in modo sistematico la dimensione logistica dell'inventario domestico. Si osserva quindi una separazione tra soluzioni orientate al monitoraggio delle scorte e applicazioni focalizzate sul cambiamento comportamentale, con una limitata convergenza tra queste due prospettive.

La _review_ evidenzia inoltre che:

- Gli agenti conversazionali aumentano engagement e adesione;
- La personalizzazione è cruciale;
- La fiducia dell'utente dipende dalla trasparenza e dalla percezione di competenza.
  - ChatDiet: framework per la gestione alimentare

Un esempio funzionale che rispetti le soluzioni e gli aspetti sottolineati nella review è ChatDiet<sup>[\[5\]](#footnote-5)</sup>, "un framework basato su LLM e progettato specificamente per chatbot personalizzati di raccomandazione alimentare orientati alla nutrizione".

La ricerca che dimostra l'_effectiveness_ _rate_ del framework sottolinea come aspetti di _interpretability_, _explainability_ ed _interactivity_ siano fondamentali per incrementare, come detto, l'engagement dell'utente e fornire una risposta dinamica, che si adatti alle preferenze o alle dinamiche che possono cambiare con l'avanzare del tempo e dell'interazione. Questo caso dimostra come l'integrazione tra modelli linguistici avanzati e sistemi di raccomandazione possa essere una direzione promettente per lo sviluppo di applicazioni più adattive, accessibili ed efficaci nella gestione alimentare.

- Ambienti web commerciali attualmente esistenti
  - Applicazioni per lo stile di vita

Nel panorama commerciale sono presenti diverse soluzioni che affrontano parzialmente il problema della gestione alimentare domestica. Le applicazioni consigliate su piattaforme di download come App Store o PlayStore, sulla base di una ricerca che includa i termini _food_ o _fitness_, sono tendenzialmente di promozione di stile di vita sano e attivo e di un'alimentazione equilibrata: questo tipo di contenuti si basano o sul proporre menù giornalieri adattati per l'utente o un supporto per il tracking delle calorie e dei macronutrienti, affiancati da fitness e allenamenti.

Un'altra tipologia di applicazioni sono legate all'aspetto organizzativo: usando parole come _grocery_ la tipologia di applicazioni proposte include la gestione dello shopping alimentare, alcune volte anche affiancato dalla proposta di ricette specifiche (es. da App Store: _Crouton: Recipe Manager_).

Nonostante queste soluzioni offrano strumenti utili affiancabili alla gestione alimentare, emergono limiti ricorrenti: l'interazione è raramente basata su un dialogo naturale avanzato - aspetto che la letteratura mostra essere uno dei limiti più rilevanti - ed anche la personalizzazione risulta essere abbastanza limitata. Inoltre, infatti, l'integrazione con modelli predittivi sofisticati e con la routine effettiva dell'utente è ancora parziale ed in questo modo si riduce ulteriormente il potenziale trasformativo di queste tecnologie.

- 1. **Applicazioni di tracciamento nutrizionale**

Applicazioni come MyFitnessPal, Lifesum e YAZIO, che si concentrano principalmente sul monitoraggio alimentare e sul fitness personale, permettono di:

- Registrare gli alimenti consumati;
- Monitorare calorie e macronutrienti;
- Impostare obiettivi personalizzati;
- Visualizzare report nutrizionali.
  - **Applicazioni di scansione prodotti**

Strumenti come Yuka ed Edo consentono, invece, la valutazione qualitativa dei prodotti tramite scansione del codice a barre. L'utente riceve un punteggio relativo alla qualità nutrizionale e può visualizzare alternative considerate più salutari.

- 1. **Applicazioni per la gestione della dispensa**

Applicazioni come iThanks si focalizzano sul monitoraggio delle scadenze e sull'organizzazione degli alimenti disponibili, con l'obiettivo di ridurre lo spreco alimentare.

- Problematiche aperte nella letteratura

Dall'analisi della letteratura e delle applicazioni esistenti emergono alcune criticità strutturali. L'accuratezza dei dati rappresenta una sfida primaria: i sistemi IoT e di computer vision faticano a mantenere un inventario aggiornato senza un coinvolgimento eccessivamente attivo dell'utente e questo incide direttamente sull'affidabilità delle raccomandazioni generate.

Un secondo nodo riguarda l'engagement, di cui si è osservato in senso positivo con l'esempio di ChatDiet, proprio perché quando l'interazione richiede un eccessivo carico di input manuale, il sistema perde valore percepito e rischia di essere abbandonato. L'interfaccia conversazionale, se ben progettata, può ridurre questa eventuale frizione, però introduce nuove complessità legate alla comprensione del linguaggio naturale e alla gestione delle ambiguità da parte dello stesso agente conversazionale LLM.

Anche la dimensione della privacy è particolarmente delicata. Un sistema di gestione alimentare avanzato potrebbe trattare anche dati sanitari (allergie, diete, peso), preferenze personali e abitudini quotidiane, configurandosi come un'infrastruttura informativa sensibile. La letteratura sottolinea l'importanza di garantire trasparenza algoritmica, controllo dell'utente sui dati e adeguate misure di sicurezza nei sistemi cloud.

Infine, osservo una carenza di soluzioni che combinino in modo integrato inventario dinamico, _recommendation context-aware_ e interazione conversazionale avanzata. Molti sistemi rimangono confinati a una sola di queste dimensioni, senza sviluppare un'architettura realmente unificata. Qui colloco il contributo potenziale del mio progetto: l'integrazione di un LLM per una generazione conversazionale adattiva.

- Gap di ricerca e posizionamento del progetto

Lo stato dell'arte evidenzia una frammentazione tra sistemi hardware-oriented basati su IoT, applicazioni di inventory management manuale, chatbot nutrizionali e recommender relativamente statici. Manca ancora un sistema capace di integrare inventario domestico, routine contestuale, preferenze e vincoli sanitari in un ambiente conversazionale fluido e adattivo.

Colloco il progetto all'intersezione tra _ambient intelligence_, _Human-Computer Interaction_, _conversational_ AI, _recommendation systems_ e _smart home systems_. L'elemento distintivo risiede nell'integrazione di un modello linguistico avanzato, con l'obiettivo di costruire un ecosistema capace non solo di monitorare, ma di dialogare, suggerire e apprendere nel tempo.

Con questa analisi voglio innanzitutto identificare gli attori che agiscono sulla scena (p.e. utente singolo, famiglia, caregiver…), e poi definire i task primari dell'applicazione web (controllare le scorte alimentari, pianificare i pasti, generare la lista della spesa…), così da progettare un sistema conversazionale realmente centrato sull'utente.

- Cosa propongo con questo progetto
  - Gli obiettivi principali

Propongo questa applicazione per colmare il divario individuato nello stato dell'arte tra infrastrutture IoT orientate al monitoraggio materiale, sistemi di raccomandazione focalizzati su logiche algoritmiche isolate e agenti conversazionali prevalentemente dedicati al coaching sanitario. Il mio obiettivo generale è progettare e prototipare un sistema conversazionale integrato, capace di connettere inventario, preferenze, vincoli nutrizionali e routine quotidiane in un unico ecosistema dialogico.

In primo luogo, voglio ridurre il carico cognitivo associato alla gestione del cibo in ambito domestico. La pianificazione dei pasti, il controllo delle scorte, la verifica delle scadenze e la generazione della lista della spesa costituiscono attività frammentate, spesso distribuite nel tempo e affidate alla memoria individuale. Con l'agente conversazionale provo quindi a trasferire parte di questo carico mentale al sistema, usando l'interazione in linguaggio naturale per consentire un accesso rapido alle informazioni rilevanti e favorire decisioni informate e tempestive.

Un secondo obiettivo riguarda l'integrazione tra dimensione logistica e dimensione decisionale. A differenza di molte soluzioni esistenti, che trattano separatamente inventario e raccomandazione, voglio costruire un modello dinamico in cui le raccomandazioni - ricette, pianificazione settimanale, suggerimenti per la spesa - emergano dall'interazione tra dati aggiornati sulle scorte, preferenze espresse dall'utente e vincoli contestuali. L'agente non si limita quindi a suggerire contenuti, ma negozia soluzioni situate, adattandosi alla disponibilità reale delle risorse o a eventuali ripensamenti da parte dell'utente.

Un ulteriore obiettivo è promuovere comportamenti alimentari più sostenibili, sia dal punto di vista ambientale sia economico. L'integrazione tra monitoraggio delle scadenze e suggerimenti contestuali può contribuire alla riduzione dello spreco alimentare, mentre la pianificazione assistita della spesa può favorire una maggiore consapevolezza nei consumi. In questo senso, progetto il sistema non solo come strumento organizzativo, ma come dispositivo di supporto orientato a suggerire scelte più responsabili.

Parallelamente, intendo valorizzare la dimensione conversazionale come modalità primaria di interazione: non per sostituire completamente le interfacce tradizionali, ma per superare la rigidità dei form strutturati introducendo l'interazione dialogica nella gestione di ambiguità, richieste parziali e preferenze implicite.

- 1. Gli obiettivi trasversali

Un aspetto laterale ma non secondario riguarda la progettazione responsabile del sistema, considerata la natura potenzialmente sensibile dei dati trattati secondo principi di trasparenza e controllo da parte dell'utente, che deve mantenere consapevolezza e _agency_ rispetto ai processi decisionali supportati dall'intelligenza artificiale, evitando dinamiche opache o eccessivamente prescrittive.

Infine, con questo progetto voglio contribuire sul piano metodologico alla riflessione sull'integrazione tra IA conversazionale e sistemi di _smart home_. Il mio obiettivo non è soltanto implementare una soluzione tecnica, ma esplorare un modello di interazione in cui l'agente conversazionale operi come nodo centrale di coordinamento tra dati eterogenei, algoritmi di raccomandazione e pratiche situate. In questa prospettiva, considero l'applicazione come un caso di studio per comprendere come i modelli linguistici di grandi dimensioni possano essere integrati in ecosistemi domestici intelligenti in modo coerente, sostenibile e centrato sull'utente.

- Task Analysis
  - Notazione utilizzata

Supporto la progettazione del lavoro con una task analysis, finalizzata a scomporre in maniera sistematica le attività che l'utente deve svolgere per gestire la propria alimentazione domestica attraverso il sistema. Ho formalizzato l'analisi mediante la notazione _ConcurTaskTrees_ (CTT), che consente di rappresentare sia la struttura gerarchica dei task sia la loro natura operativa.

In particolare, i task sono stati classificati secondo quattro categorie:

- _User task_, che rappresentano le decisioni e le valutazioni cognitive dell'utente;
- _Interaction task_, che descrivono le azioni compiute sull'interfaccia;
- _Application task_, che includono le elaborazioni automatiche del sistema e le funzionalità basate su intelligenza artificiale;
- _Abstraction task_, utilizzati per organizzare gerarchicamente le attività senza rappresentare azioni esecutive dirette.

Inoltre, gli operatori temporali vengono classificati come segue:

- Sequenzialità: T1 >> T2 or T1 \[\]>> T2
- Disabilitazione: T1 \[> T2
- Interruzione: T1 |> T2
- Scelta: T1 \[\] T2
- Iterazione: T1\* or T1{n}
- Concorrenza: T1 ||| T2 e anche T1 |\[\]| T2
- Opzionalità: \[T\]
- Ordine indipendente: T1 |=| T2

Ho organizzato l'intero modello attorno al task principale di livello più alto, "gestire l'alimentazione domestica", articolato in cinque sotto-task poi ulteriormente sotto-categorizzati: "accesso e configurazione", "gestione degli alimenti", "pianificazione dei pasti", "gestione della spesa" e "monitoraggio nutrizionale".

La task analysis evidenzia come l'applicazione non si limiti alla registrazione delle informazioni, ma si configuri come un sistema proattivo di supporto decisionale. In particolare, i task di tipo Application - che includono le componenti di intelligenza artificiale - svolgono un ruolo chiave nel ridurre il carico cognitivo dell'utente, automatizzando processi complessi e fornendo suggerimenti personalizzati, pur mantenendo l'utente al centro delle decisioni finali.

Il mio obiettivo principale è integrare in un unico ecosistema digitale funzioni che, nelle applicazioni attualmente disponibili, risultano spesso separate: tracciamento nutrizionale, scansione dei prodotti, gestione degli alimenti presenti in casa e pianificazione della spesa.

- 1. Accesso e configurazione

Il primo sotto-task comprende le operazioni preliminari necessarie all'utilizzo del sistema; include la creazione dell'account e l'accesso, che permettono l'accesso al profilo utente.

**Creazione account** (Interaction Task): Inserire email o username |=| Inserire password >> Confermare password >> Accettare termini e condizioni >> Confermare la registrazione.

**Creazione account** (Application Task): Verifica validità email >> Controllo sicurezza password >> Creazione profilo utente >> Salvataggio dati nel database.

**Login** (Interaction Task): Inserire credenziali >> Avviare autenticazione \[\] Recuperare password dimenticata.

**Login** (Application Task): Verifica credenziali >> Apertura sessione utente \[\] Autenticazione automatica.

Una volta effettuato l'accesso, l'utente procede all'inserimento dei dati personali e sanitari, tra cui: età, peso, altezza, livello di attività fisica, abitudini alimentari, eventuali allergie o intolleranze, obiettivi nutrizionali.

**Inserimento dati personali e sanitari** (Interaction Task): Inserimento età |=| Inserimento peso |=| Inserimento altezza |=| Selezione livello di attività fisica |=| Inserimento abitudini alimentari |=| Specificazione allergie/intolleranze |=| Definizione obiettivi nutrizionali.

**Inserimento dati personali e sanitari** (User Task): Valutazione correttezza dati inseriti >> Selezione obiettivi coerenti con le proprie esigenze.

**Inserimento dati personali e sanitari** (Application Task): Calcolo metabolismo basale >> Calcolo fabbisogno calorico >> Generazione profilo nutrizionale iniziale >> Personalizzazione parametri IA.

Queste informazioni vengono elaborate automaticamente dal sistema per generare un profilo nutrizionale iniziale, che costituisce la base per tutte le successive elaborazioni dell'intelligenza artificiale, come il calcolo del fabbisogno calorico giornaliero o la personalizzazione delle ricette suggerite.

Rientrano inoltre in questa sezione le impostazioni dell'applicazione, che comprendono la gestione della lingua, la configurazione delle notifiche, le preferenze relative alla privacy, la sincronizzazione cloud e la connessione con servizi esterni, qualora si utilizzino dispositivi terzi connessi all'applicazione.

**Configurazione applicazione** (Interaction Task): Selezionare lingua |=| Configurare notifiche |=| Gestire impostazioni privacy |=| Attivare sincronizzazione cloud |=| Collegare servizi esterni.

**Configurazione applicazione** (Application Task): Applicazione preferenze |=| Sincronizzazione dati |=| Gestione autorizzazioni e permessi.

- 1. Gestione degli alimenti e tracciamento dei valori nutrizionali

Il secondo sotto-task riguarda l'acquisizione e la gestione delle informazioni nutrizionali degli alimenti. L'utente può scegliere tra diverse modalità di inserimento: scansione del codice a barre, inserimento manuale oppure riconoscimento tramite IA a partire da immagini.

Task principale: **Gestione alimenti** (Abstraction Task): Inserimento alimento >> Validazione dati \[\] Consultazione archivio alimenti.

- 1. **Inserimento alimento**:

**Modalità A** - **Scansione codice a barre**:

- Apertura scanner >> Inquadramento codice >> Conferma alimento riconosciuto.
- Application Task: Lettura codice >> Ricerca alimento nel database >> Recupero valori nutrizionali.

**Modalità B** - **Inserimento manuale**:

- Inserimento nome alimento |=| Inserimento marca/prodotto |=| Inserimento valori nutrizionali >> Salvataggio alimento.
- User Task: Verifica correttezza dati inseriti.

**Modalità C** - **Riconoscimento tramite IA**:

- Application Task: Caricamento/scatto di immagine >> Conferma identificazione alimento >> Analisi immagine >> Riconoscimento alimento >> Estrazione valori nutrizionali stimati.
  - **Validazione dati**:
- User Task: Controllo correttezza alimento >> Conferma o modifica valori nutrizionali.
- Application Task: Aggiornamento database personale >> Salvataggio storico alimenti.
  - **Consultazione archivio alimenti**:
- Interaction Task: Ricerca alimento salvato >> Visualizzazione valori nutrizionali >> Modifica o eliminazione alimento.
- Application Task: Recupero dati archivio >> Aggiornamento modifiche.

A seconda della modalità selezionata, il sistema recupera o elabora automaticamente i dati nutrizionali, che vengono poi validati e salvati. In questa fase, le funzionalità di intelligenza artificiale svolgono un ruolo centrale come task di tipo Application, in particolare per il riconoscimento degli alimenti e l'estrazione delle informazioni nutrizionali.

- 1. Pianificazione dei pasti e suggerimento ricette

La terza macro-area supporta l'utente nella scelta dei pasti. Il sistema consente di ottenere suggerimenti di ricette in base a due principali criteri: gli alimenti disponibili (ad esempio quelli presenti in frigorifero) oppure le preferenze espresse dall'utente.

L'intelligenza artificiale analizza i dati disponibili e genera proposte di ricette, che l'utente può valutare e selezionare. A questa funzionalità si affianca la generazione automatica di liste della spesa e ricettari associati, costruiti sulla base delle abitudini alimentari e dei dati nutrizionali.

Task principale: **Pianificazione pasti** (Abstraction Task): Definizione criteri di ricerca >> Generazione suggerimenti ricette \[\] Valutazione ricette \[\] Creazione piano pasti \[\] Generazione automatica ricette e spesa.

- **Definizione criteri di ricerca**:

- Interaction Task: Inserimento ingredienti disponibili >> Specifica preferenze alimentari >> Definizione restrizioni nutrizionali.
- User Task: Valutazione disponibilità alimenti >> Specifica preferenze e priorità

- **Generazione suggerimenti ricette**:

- Application Task: Analisi ingredienti disponibili >> Analisi profilo nutrizionale >> Generazione ricette compatibili >> Ordinamento proposte per priorità nutrizionale

- **Valutazione ricette**:

- User Task: Consultazione ricette suggerite \[\] Valutazione ingredienti e valori nutrizionali \[\] Selezione ricetta desiderata.

- **Creazione piano pasti**:

- Interaction Task: Assegnamento ricette ai giorni della settimana >> Modifica o sostituzione pasti >> Salvataggio pianificazione.
- Application Task: Aggiornamento bilancio calorico settimanale >> Calcolo valori nutrizionali complessivi.

- **Generazione automatica ricette e spesa**:

- Application Task: Creazione ricettario personalizzato >> Generazione lista ingredienti mancanti >> Creazione lista della spesa.
  - Gestione della spesa

La quarta macro-area riguarda la pianificazione degli acquisti. L'utente può creare una lista della spesa manuale, inserendo i prodotti desiderati, mentre il sistema fornisce suggerimenti e correzioni automatiche basati sui dati disponibili e sulle abitudini registrate.

Task principale: **Gestione spesa** (Abstraction Task): Creazione lista della spesa → Suggerimento automatico prodotti → Revisione lista → Gestione acquisti.

- **Creazione lista della spesa**:
- Interaction Task: Inserire prodotti manualmente >> Definire quantità >> Organizzare prodotti per categoria
- **Suggerimento automatico prodotti**:
- Application Task: Analisi alimenti mancanti >> Analisi abitudini d'acquisto >> Proposta automatica prodotti
- **Revisione lista**:
- User Task: Valutazione suggerimenti del sistema >> Accettare/rifiutare prodotti >> Modifica quantità o elementi
- **Gestione acquisti**:
- Interaction Task: Contrassegna prodotti acquistati >> Eliminazione prodotti non necessari >> Aggiornamento disponibilità dispensa
- Application Task: Aggiornamento inventario alimenti >> Sincronizzazione lista su cloud

Anche in questo caso si osserva una collaborazione tra utente e sistema: l'IA propone, ma l'utente mantiene il controllo finale attraverso la valutazione e la modifica della lista.

- 1. Monitoraggio nutrizionale

L'ultima macro-area comprende le funzionalità di monitoraggio e supporto continuo. Il sistema consente il conteggio delle calorie e dei valori nutrizionali su base settimanale, calcolati in relazione al metabolismo basale e ai dati inseriti dall'utente.

A queste si aggiunge la possibilità di connettere dispositivi esterni, come app di salute o smartwatch, per integrare dati biometrici, e un sistema di promemoria intelligenti, che incoraggia l'inserimento regolare dei dati e il mantenimento di buone abitudini, come l'idratazione.

Task principale: **Monitoraggio nutrizionale** (Abstraction Task): Registrazione consumo alimentare >> Analisi nutrizionale >> Valutazione risultati \[\] Connessione dispositivi esterni \[\] Gestione promemoria intelligenti.

- **Registrazione consumo alimentare**:

- Interaction Task: Selezionare alimento consumato >> Inserire quantità >> Registrare pasto.
- Application Task: Calcolo calorie assunte >> Calcolo macronutrienti >> Aggiornamento diario alimentare.

- **Analisi nutrizionale**:

- Application Task: Calcolo andamento giornaliero >> Calcolo andamento settimanale >> Confronto con obiettivi nutrizionali >> Generazione statistiche.

- **Valutazione risultati**:

- User Task: Interpretazione grafici e statistiche >> Valutazione progressi >> Eventuale modifica alle abitudini.

- **Connessione dispositivi esterni**:

- Interaction Task: Collegare smartwatch o app salute >> Autorizzare accesso ai dati.
- Application Task: Importazione dati biometrici >> Sincronizzazione attività fisica >> Aggiornamento consumo calorico.

- **Gestione promemoria intelligenti**:
- Application Task: Invio notifiche per registrazione pasti \[\] Invio promemoria idratazione \[\] Suggerimento automatico per il mantenimento delle abitudini alimentari corrette.
- Progettazione concreta del wireframe attraverso Figma

Ho usato Figma per supportare la fase di progettazione grafica preliminare dell'interfaccia. Il prototipo ad alta fedeltà traduce i requisiti funzionali individuati nella _task analysis_ in un modello interattivo.

Le figure che seguono mostrano alcune pagine del prototipo e permettono di verificare il flusso di navigazione tra le cinque sezioni in cui ho suddiviso la piattaforma.

- 1. **Nutrition**

La prima sezione racchiude l'apporto macro-nutrizionale giornaliero dell'utente e la possibilità di inserire anche manualmente i propri pasti;

- 1. **Recipes**

La seconda sezione include tanto la generazione di ricette veloci a partire dell'assistente AI, come una parte conversazionale con il LLM per un'interazione diretta;

- 1. **Grocery**

La terza sezione permette di inserire la lista della spesa utente - **valutare due aspetti**: lista della spesa per fare la spesa che si aggiorna ad alimenti comprati + scan del QR code che permette di inserire gli alimenti "in dispensa". Va sottinteso che il profilo tiene memoria di ciò che l'utente ha in casa (aggiungere una funzione di questo tipo in questa sezione?)

- 1. **Progress**

La quarta sezione racchiude i progressi nutrizionali su scala settimanale o su scala mensile dell'utente, selezionando i dati delle calorie e delle proteine assunte, dell'acqua bevuta giornalmente e i cambiamenti di peso registrati;

- 1. **Profile**

La quinta e ultima sezione permette all'utente di salvare i dati personali, medici e fisici, gli obiettivi nutrizionali ed il tipo di dieta che si preferisce seguire.

- Utilizzo dei dataset per un approccio RAG
  - **Open Food Facts**

Si tratta di un database globale, aperto e collaborativo che contiene i dati di milioni di prodotti confezionati da tutto il mondo. Include codici a barre (EAN), ingredienti, allergeni e tabelle nutrizionali. Nel progetto posso impiegare il dataset ufficiale OpenFoodFacts in due modi complementari: come sorgente live per il recupero immediato dei prodotti tramite barcode scanning e come dump/export ufficiale per costruire una knowledge base locale a supporto di un approccio RAG. In questo secondo caso, posso normalizzare i record in documenti strutturati contenenti barcode, nome prodotto, marca, categoria, valori nutrizionali, Nutri-Score e metadati di provenienza, così da ridurre il rischio di allucinazioni nelle raccomandazioni nutrizionali e nelle funzioni di inventory management → [link dataset](https://world.openfoodfacts.org/data) + [link al sito](https://it.openfoodfacts.org/).

- 1. **Recipe1M+. A Dataset for Learning Cross-Modal Embeddings for Cooking Recipes and Food Images**

Questo lavoro di addestramento di una rete neurale è volto a insegnarle un incorporamento congiunto di ricette e immagini su un'attività di recupero di immagini-ricette. Si dimostra che la regolarizzazione attraverso l'aggiunta di un obiettivo di classificazione di alto livello migliora le prestazioni di recupero per rivaleggiare con quelle degli esseri umani e consente l'aritmetica del vettore semantico. L'ipotesi è che questi incorporamenti forniranno una base per un'ulteriore esplorazione del set di dati Recipe1M+ e del cibo e della cucina in generale. Codice, dati e modelli sono disponibili pubblicamente → [link progetto](https://im2recipe.csail.mit.edu/).

- 1. **Diet Plan Recommendation**

Predicts diet plan based on calories to maintain weight → [dataset](https://www.kaggle.com/datasets/vechoo/diet-plan-recommendation).

- 1. **Food.com - Recipes and Reviews**

The recipes dataset contains 522,517 recipes from 312 different categories. This dataset provides information about each recipe like cooking times, servings, ingredients, nutrition, instructions, and more. The reviews dataset contains 1,401,982 reviews from 271,907 different users. This dataset provides information about the author, rating, review text, and more → [link dataset](https://www.kaggle.com/datasets/irkaal/foodcom-recipes-and-reviews).


"A prompt for a Large Language Model (LLM) is a text input that initiates a conversation or triggers a response from the model. However, it can be in other forms such as an image or audio."

"Prompt engineering is the process of designing and optimizing input prompts to effectively guide a language model's responses."

(fonte: [Prompt engineering best practices for ChatGPT](https://help.openai.com/en/articles/10032626-prompt-engineering-best-practices-for-chatgpt))

- Bibliografia

Amil, S., Gagnon, M.-P., Bédard, A., Da, S. M. A. R., Zavala Mora, D., Drapeau, V., & Desroches, S. (2025). Interactive Conversational Agents to Improve Dietary Behaviors for Health Promotion: Mixed Systematic Review. _Journal of Medical Internet Research_, _27_, e78220-e78220. <https://doi.org/10.2196/78220>

Bhushan, D., & Agrawal, R. (2020). The Internet of Things: Looking beyond the hype. In _An Industrial IoT Approach for Pharmaceutical Industry Growth_ (pp. 231-255). Elsevier. <https://doi.org/10.1016/B978-0-12-821326-1.00008-5>

Casini, L., Contini, C., Romano, C., & Scozzafava, G. (2015). Trends in food consumptions: What is happening to generation X? _British Food Journal_, _117_(2), 705-718. <https://doi.org/10.1108/BFJ-10-2013-0283>

Felicetti, A. M., Volpentesta, A. P., Linzalone, R., & Ammirato, S. (2023). Information Behaviour of Food Consumers: A Systematic Literature Review and a Future Research Agenda. _Sustainability_, _15_(4), 3758. <https://doi.org/10.3390/su15043758>

Goharian, N., Tonellotto, N., He, Y., Lipani, A., McDonald, G., Macdonald, C., & Ounis, I. (A c. Di). (2024). _Advances in Information Retrieval: 46th European Conference on Information Retrieval, ECIR 2024, Glasgow, UK, March 24-28, 2024, Proceedings, Part III_ (Vol. 14610). Springer Nature Switzerland. <https://doi.org/10.1007/978-3-031-56063-7>

Golshany, H., Ni, Y., Yu, Q., & Fan, L. (2025). IoT-enabled smart kitchen technologies and their impact on food storage, preparation, and culinary experiences: A systematic review. _Food Research International_, _213_, 116557. <https://doi.org/10.1016/j.foodres.2025.116557>

Gunge, V. S. (s.d.). Smart Home Automation: A Literature Review. _International Journal of Computer Applications_.

Min, W., Jiang, S., & Jain, R. (2020). Food Recommendation: Framework, Existing Solutions, and Challenges. _IEEE Transactions on Multimedia_, _22_(10), 2659-2671. <https://doi.org/10.1109/TMM.2019.2958761>

Ortiz Kristine Joyce P., Bautista Pocholo Nico P., Dimailig Mark Vincent D., & Llamzon Andrew Christian D. (2023). Recipe Recommendation System Using IoT-Based Food Inventory Management of Perishables for Household Food Waste Reduction. _Chemical Engineering Transactions_, _106_, 361-366. <https://doi.org/10.3303/CET23106061>

Principato, L., Secondi, L., & Pratesi, C. A. (2015). Reducing food waste: An investigation on the behaviour of Italian youths. _British Food Journal_, _117_(2), 731-748. <https://doi.org/10.1108/BFJ-10-2013-0314>

Rayes, A., & Salam, S. (2019). _Internet of Things From Hype to Reality: The Road to Digitization_. Springer International Publishing. <https://doi.org/10.1007/978-3-319-99516-8>

Sandholm, T., Lee, D., Tegelund, B., Han, S., Shin, B., & Kim, B. (2014). _CloudFridge: A Testbed for Smart Fridge Interactions_ (arXiv:1401.0585). arXiv. <https://doi.org/10.48550/arXiv.1401.0585>

Singh, A. K., Firoz, N., Tripathi, A., Singh, K. K., Choudhary, P., & Vashist, P. C. (2020). Chapter 7-Internet of Things: From hype to reality. In V. E. Balas, V. K. Solanki, & R. Kumar (A c. Di), _An Industrial IoT Approach for Pharmaceutical Industry Growth_ (pp. 191-230). Academic Press. <https://doi.org/10.1016/B978-0-12-821326-1.00007-3>

Sinha, G., Shahi, R., & Shankar, M. (2010). Human Computer Interaction. _2010 3rd International Conference on Emerging Trends in Engineering and Technology_, 1-4. <https://doi.org/10.1109/ICETET.2010.85>

Spurlock, K. D., Acun, C., Saka, E., & Nasraoui, O. (2024). _ChatGPT for Conversational Recommendation: Refining Recommendations by Reprompting with Feedback_ (arXiv:2401.03605). arXiv. <https://doi.org/10.48550/arXiv.2401.03605>

Yang, Z., Khatibi, E., Nagesh, N., Abbasian, M., Azimi, I., Jain, R., & Rahmani, A. M. (2024). ChatDiet: Empowering Personalized Nutrition-Oriented Food Recommender Chatbots through an LLM-Augmented Framework. _Smart Health_, _32_, 100465. <https://doi.org/10.1016/j.smhl.2024.100465>

Zhang, J., Bao, K., Zhang, Y., Wang, W., Feng, F., & He, X. (2023). Is ChatGPT Fair for Recommendation? Evaluating Fairness in Large Language Model Recommendation. _Proceedings of the 17th ACM Conference on Recommender Systems_, 993-999. <https://doi.org/10.1145/3604915.3608860>

- Ortiz Kristine et al. (2023). Recipe Recommendation System Using IoT-Based Food Inventory Management of Perishables for Household Food Waste Reduction. Chemical Engineering Transactions, 106, 361-366. [↑](#footnote-ref-1)

- Principato, L., Secondi, L., & Pratesi, C. A. (2015). Reducing food waste: An investigation on the behaviour of Italian youths. British Food Journal, 117(2), 731-748. <https://doi.org/10.1108/BFJ-10-2013-0314> [↑](#footnote-ref-2)

- Sandholm, T., Lee, D., Tegelund, B., Han, S., Shin, B., & Kim, B. (2014). CloudFridge: A Testbed for Smart Fridge Interactions (arXiv:1401.0585). arXiv. <https://doi.org/10.48550/arXiv.1401.0585> [↑](#footnote-ref-3)

- Amil, S. et al (2025). Interactive Conversational Agents to Improve Dietary Behaviors for Health Promotion: Mixed Systematic Review. Journal of Medical Internet Research, 27. [↑](#footnote-ref-4)

- Yang, Z., Khatibi, E., Nagesh, N., Abbasian, M., Azimi, I., Jain, R., & Rahmani, A. M. (2024). ChatDiet: Empowering Personalized Nutrition-Oriented Food Recommender Chatbots through an LLM-Augmented Framework. Smart Health, 32, 100465. <https://doi.org/10.1016/j.smhl.2024.100465> [↑](#footnote-ref-5)
