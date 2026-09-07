# Aggiornamenti ai capitoli precedenti e Capitolo 6 revisionato

## Paragrafi precedenti da aggiornare

### Accuratezza dei dati e contesto aumentato

Nei sistemi di raccomandazione basati su Large Language Models, l'accuratezza non può essere valutata soltanto come correttezza linguistica della risposta generata. Nel dominio alimentare, infatti, una risposta formalmente plausibile può comunque risultare problematica se propone valori nutrizionali non verificabili, interpreta in modo scorretto un alimento, ignora vincoli personali o produce raccomandazioni non coerenti con la situazione reale dell'utente. Per questo motivo, nel progetto NutriTrack l'uso dell'Intelligenza Artificiale non è concepito come generazione autonoma e isolata, ma come componente inserita in un contesto applicativo controllato.

Questa impostazione consente di affrontare il tema dell'accuratezza attraverso un approccio di contesto aumentato. Prima della generazione della risposta, il sistema raccoglie dati provenienti dal profilo utente, dalla dispensa, dalla lista della spesa, dai pasti già registrati, dalle ricette recenti e da fonti dati esterne. Tali informazioni vengono normalizzate e rese disponibili al modello come riferimenti operativi. In questo modo, l'assistente non si basa esclusivamente sulla conoscenza appresa durante l'addestramento, ma può produrre risposte ancorate a dati più pertinenti rispetto alla situazione specifica dell'utente.

L'approccio adottato non equivale a una pipeline RAG completa basata su embedding vettoriali e indicizzazione semantica. Nel prototipo, infatti, il recupero delle informazioni avviene attraverso lookup applicativi, cache, ricerca testuale e selezione contestuale dei dati rilevanti. Tuttavia, il principio progettuale è affine alla logica della Retrieval-Augmented Generation: ridurre l'opacità della generazione linguistica fornendo al modello un contesto esterno, strutturato e controllabile. Questa distinzione è importante per descrivere il progetto in modo tecnicamente preciso e difendibile.

### Obiettivi del progetto

Rispetto alle applicazioni tradizionali di tracciamento nutrizionale o gestione della dispensa, NutriTrack mira a integrare in un unico ambiente dati alimentari, stato domestico, obiettivi personali e supporto conversazionale. L'obiettivo non è soltanto registrare pasti o prodotti, ma costruire un sistema capace di mettere in relazione ciò che l'utente possiede, ciò che consuma, ciò che desidera pianificare e ciò che deve monitorare nel tempo.

In questa prospettiva, le fonti dati esterne assumono un ruolo di supporto alla decisione. Open Food Facts consente di recuperare informazioni relative ai prodotti confezionati tramite codice a barre; FoodData Central fornisce riferimenti nutrizionali per alimenti generici e ingredienti non necessariamente confezionati; il Compendium of Physical Activities permette di stimare il dispendio energetico associato ad attività fisiche attraverso valori MET. L'Intelligenza Artificiale opera quindi all'interno di un ecosistema più ampio, nel quale i dati esterni contribuiscono a rendere più fondate le stime e più coerenti le raccomandazioni.

### Task analysis: monitoraggio nutrizionale e attività fisica

La macro-area del monitoraggio non riguarda soltanto le calorie assunte attraverso i pasti, ma anche il rapporto tra alimentazione, obiettivi giornalieri, idratazione, peso e dispendio energetico. Nel prototipo, l'utente può registrare manualmente un'attività fisica oppure selezionarla da un catalogo derivato dal 2024 Compendium of Physical Activities. A partire dal tipo di attività, dalla durata e dal peso corporeo disponibile nel profilo o nel log giornaliero, il sistema produce una stima delle calorie spese.

Dal punto di vista della task analysis, questa funzione introduce un'interazione ibrida: l'utente mantiene il controllo sull'inserimento dell'attività e può correggere il valore calorico, mentre il sistema propone automaticamente una stima iniziale basata su un dataset esterno. Il task di monitoraggio diventa quindi un processo di registrazione assistita, non un calcolo interamente manuale né una valutazione completamente automatica.

### Capitolo 5: punti da aggiornare

Nel capitolo sull'implementazione del prototipo è opportuno aggiornare la descrizione del modulo Dieta, del modulo Ricette e del modulo Progressi. Per il modulo Dieta, va specificato che l'inserimento del pasto può avvenire tramite descrizione testuale, barcode, compilazione manuale o immagine. Nel caso dell'immagine, l'interfaccia consente di scegliere tra acquisizione da fotocamera e selezione dalla galleria, mantenendo lo stesso flusso di riconoscimento AI. Dopo il riconoscimento, la descrizione prodotta viene inserita nel campo del pasto e può essere verificata dall'utente prima del salvataggio.

Nel modulo Ricette e nell'analisi dei pasti va aggiunto che FoodData Central è stato integrato come fonte nutrizionale di supporto lato backend. Questa integrazione non modifica l'interfaccia utente e non introduce una nuova etichetta visibile: l'utente continua a visualizzare l'operazione come analisi AI. Dal punto di vista implementativo, però, il modello può ricevere riferimenti nutrizionali esterni per rendere più plausibili calorie e macronutrienti nelle ricette generate e nei pasti descritti liberamente.

Nel modulo Progressi, invece, va chiarito che il calcolo delle calorie spese da attività fisica non si basa più su un catalogo hardcoded, ma su CSV derivati dal 2024 Adult Compendium of Physical Activities e dal 2024 Older Adult Compendium. Il sistema seleziona automaticamente il dataset in base all'età presente nel profilo: per utenti adulti utilizza i MET standard, mentre per utenti da 60 anni in su utilizza i valori MET60+ e una diversa base di consumo a riposo.

# 6. Fonti dati esterne, contesto applicativo e prompt engineering

## 6.1 Ruolo delle fonti dati nel prototipo

NutriTrack integra diverse fonti dati con ruoli complementari. La scelta di utilizzare dataset e API esterne nasce dall'esigenza di ridurre il rischio che l'Intelligenza Artificiale produca stime nutrizionali o suggerimenti alimentari basati soltanto su conoscenza generale. Nel dominio alimentare, infatti, il valore di una raccomandazione dipende dalla sua coerenza con dati concreti: prodotti realmente disponibili, ingredienti inseriti dall'utente, obiettivi personali, valori nutrizionali, attività svolte e storico dei pasti.

Le fonti dati non sostituiscono il modello AI, ma ne orientano il comportamento. Il modello resta responsabile dell'interpretazione linguistica, della generazione di ricette, della trasformazione di descrizioni libere in dati strutturati e della gestione conversazionale. I dataset, invece, forniscono riferimenti più controllabili: codici a barre, tabelle nutrizionali, valori per 100 g, categorie alimentari, MET e metadati di provenienza. Questa separazione permette di presentare l'AI come componente di supporto e non come fonte unica di verità.

Nel prototipo sono presenti tre nuclei principali di dati esterni: Open Food Facts per i prodotti confezionati, FoodData Central per alimenti generici e riferimenti nutrizionali, e il Compendium of Physical Activities per la stima del dispendio energetico. A questi si aggiungono i dati applicativi prodotti dall'utente, come profilo, preferenze, dispensa, lista della spesa, pasti registrati, ricette generate, progressi e misurazioni. Il valore del sistema deriva dall'integrazione tra queste informazioni eterogenee.

## 6.2 Open Food Facts: prodotti confezionati e barcode

Open Food Facts è un database aperto e collaborativo che raccoglie informazioni su prodotti confezionati provenienti da diversi paesi. I record possono includere codice a barre, nome del prodotto, marca, ingredienti, allergeni, quantità, valori nutrizionali e indicatori sintetici come il Nutri-Score. Nel contesto di NutriTrack, questa fonte è particolarmente adatta ai flussi basati su barcode, perché consente di collegare un prodotto fisico a un record digitale riutilizzabile.

Nel prototipo, il lookup Open Food Facts viene utilizzato nelle sezioni Dispensa e Dieta. Quando l'utente scansiona o inserisce un codice a barre, il sistema recupera le informazioni disponibili, normalizza i campi nutrizionali rilevanti e li usa per compilare prodotti, pasti o confronti. I valori vengono inoltre mantenuti nello stato applicativo come cache, così da poter essere riutilizzati in seguito senza dipendere ogni volta dalla disponibilità immediata dell'API.

L'uso di Open Food Facts presenta tuttavia alcuni limiti. Essendo una base dati collaborativa, i record possono essere incompleti, aggiornati in modo non uniforme o privi di alcuni nutrienti. Per questo motivo, il sistema non tratta il recupero automatico come dato definitivo: l'utente può correggere le informazioni prima del salvataggio o modificare successivamente i valori registrati. Questa scelta è coerente con l'impostazione generale del progetto, in cui l'automazione propone e l'utente valida.

## 6.3 FoodData Central: alimenti generici e riferimenti nutrizionali

FoodData Central, messo a disposizione dal Dipartimento dell'Agricoltura degli Stati Uniti, fornisce accesso a dati nutrizionali relativi ad alimenti e prodotti alimentari attraverso API. A differenza di Open Food Facts, che risulta particolarmente utile per prodotti confezionati identificabili tramite barcode, FoodData Central è più adatto al recupero di valori nutrizionali per alimenti generici o ingredienti non necessariamente associati a una confezione commerciale.

Nel prototipo, FoodData Central è stato integrato lato backend come fonte di supporto per due flussi: la generazione di ricette e l'analisi dei pasti inseriti liberamente. Quando l'utente descrive un pasto, il sistema prova a scomporre la descrizione in componenti alimentari, normalizza alcune interrogazioni in inglese quando necessario e recupera valori nutrizionali come calorie, proteine, carboidrati e grassi per 100 g. Se la quantità è espressa in grammi o millilitri, tali valori possono essere scalati rispetto alla porzione indicata.

Nel generatore di ricette, i riferimenti FoodData Central vengono usati come ancoraggio per rendere più plausibili le stime nutrizionali prodotte dal modello. Questo non significa che l'applicazione effettui una validazione nutrizionale completa o clinica della ricetta: le calorie e i macronutrienti restano stime applicative. Tuttavia, la presenza di una fonte dati esterna riduce la probabilità che il modello generi valori arbitrari o incoerenti.

Dal punto di vista dell'interfaccia, questa integrazione non viene presentata come una funzione separata. L'utente continua a visualizzare l'operazione come "Analisi AI", perché il risultato finale deriva comunque dall'interpretazione del modello. FoodData Central agisce come supporto interno alla generazione e non come etichetta comunicativa autonoma. Questa scelta evita di sovraccaricare l'interfaccia con dettagli tecnici, mantenendo però la possibilità di descrivere nella tesi il ruolo metodologico della fonte esterna.

## 6.4 Compendium of Physical Activities e valori MET

Per la stima del dispendio energetico associato all'attività fisica, NutriTrack utilizza dataset derivati dal 2024 Compendium of Physical Activities. Il Compendium classifica attività diverse attraverso codici e valori MET, cioè metabolic equivalent of task. Il MET esprime il rapporto tra il costo energetico di un'attività e il metabolismo a riposo: un'attività con valore MET più alto richiede un dispendio energetico maggiore rispetto a un'attività sedentaria.

Nel prototipo sono stati predisposti due CSV: uno derivato dal 2024 Adult Compendium e uno derivato dal 2024 Older Adult Compendium. Il primo contiene le attività per la popolazione adulta e utilizza la base standard di 1 MET pari a 3,5 ml/kg/min di consumo di ossigeno a riposo. Il secondo è dedicato agli utenti anziani e utilizza i valori MET60+ con una base di riposo pari a 2,7 ml/kg/min. La distinzione è rilevante perché il costo energetico relativo delle attività può variare con l'età e con il metabolismo a riposo.

Quando l'utente inserisce un'attività, il sistema cerca nel catalogo CSV le voci più pertinenti rispetto alla descrizione digitata. Dopo la selezione, la stima delle calorie spese viene calcolata combinando MET, durata e peso corporeo. La formula utilizzata è:

`kcal = MET x VO2 a riposo x peso corporeo x durata / 200`

Il peso viene ricavato dal log giornaliero o, in assenza di un valore specifico, dal profilo utente. L'utente può comunque inserire manualmente le calorie spese o correggere la stima proposta. Anche in questo caso, quindi, il dataset non elimina il ruolo dell'utente, ma riduce il lavoro manuale e fornisce una base più trasparente per il calcolo.

L'integrazione dei MET amplia il perimetro di NutriTrack oltre il solo conteggio delle calorie assunte. Il sistema può infatti mettere in relazione alimentazione, attività fisica e obiettivi giornalieri. La possibilità di scegliere se includere o meno le calorie spese nell'obiettivo calorico residuo permette inoltre di adattare il comportamento dell'app a diverse preferenze di monitoraggio.

## 6.5 Dataset considerati e scelte di delimitazione

Durante la progettazione sono stati considerati anche dataset orientati alle ricette, come Recipe1M+ o raccolte di ricette e recensioni disponibili su piattaforme pubbliche. Queste risorse sono rilevanti per sistemi di raccomandazione culinaria perché collegano ingredienti, istruzioni, categorie, immagini e preferenze degli utenti. Tuttavia, nel prototipo attuale non vengono usate come sorgenti operative.

La scelta di non integrare direttamente un grande dataset di ricette è legata agli obiettivi del progetto. NutriTrack non mira a costruire un motore di raccomandazione basato su un catalogo statico di ricette, ma un sistema capace di generare proposte situate a partire da dispensa, preferenze, obiettivi e richieste dell'utente. In questo quadro, la generazione AI risulta più adatta a produrre ricette personalizzate e modificabili, mentre i dataset esterni vengono usati soprattutto per ancorare nutrienti, prodotti e stime energetiche.

Recipe1M+ e dataset analoghi possono quindi essere collocati tra gli sviluppi futuri. Una possibile evoluzione consisterebbe nell'indicizzare ricette esistenti, recuperare esempi pertinenti rispetto agli ingredienti disponibili e usare il modello AI per adattarli al profilo utente. Questo rappresenterebbe una pipeline RAG più completa rispetto a quella attualmente implementata, ma richiederebbe una fase ulteriore di pulizia, indicizzazione, valutazione della qualità e gestione delle licenze.

## 6.6 Dal dataset al contesto aumentato

Il prototipo non utilizza i dataset come archivi isolati, ma li trasforma in contesto operativo per le funzionalità dell'applicazione. Il concetto centrale è quello di contesto aumentato: prima di chiamare il modello AI, il backend raccoglie informazioni pertinenti, le riduce a blocchi comprensibili e le inserisce nel prompt come vincoli o riferimenti. La risposta generata viene quindi prodotta dentro un perimetro informativo più controllato.

Nel caso delle ricette, il contesto può includere la dispensa ordinata per priorità, gli ingredienti con scadenza ravvicinata, la lista della spesa, gli obiettivi nutrizionali, i pasti recenti, le ricette già generate nella sessione e i riferimenti FoodData Central. Questo permette al modello di proporre ricette non solo linguisticamente plausibili, ma anche coerenti con le risorse reali disponibili e con la necessità di evitare ripetizioni.

Nel caso della chat dell'assistente, il contesto comprende profilo, preferenze, obiettivi, dispensa, ricette correnti e dati Open Food Facts già recuperati. L'assistente non deve quindi comportarsi come un chatbot generalista, ma come un componente dell'app che conosce lo stato corrente del sistema. Questa impostazione consente di rispondere a domande come "cosa posso cucinare con quello che ho?" o "come posso modificare questa ricetta?" utilizzando dati applicativi concreti.

Nel caso dell'analisi dei pasti, il contesto può derivare da una descrizione scritta dall'utente oppure da una foto del pasto. L'immagine viene prima trasformata in una descrizione testuale strutturata e poi analizzata nutrizionalmente. La recente distinzione tra acquisizione da fotocamera e selezione da galleria non modifica la logica AI, ma rende più flessibile il momento di input: l'utente può fotografare il pasto al momento oppure caricare un'immagine già disponibile.

## 6.7 Prompt engineering per ricette, pasti e immagini

Il prompt engineering è stato usato per rendere prevedibile il comportamento del modello e per ridurre risposte generiche. Nei flussi principali, il prompt non si limita a chiedere una risposta in linguaggio naturale, ma definisce ruolo, vincoli, formato, tono e limiti dell'assistente. Il modello deve rispondere in italiano, usare il contesto applicativo quando disponibile, rispettare allergie e preferenze, evitare raccomandazioni mediche e dichiarare incertezza quando i dati non sono sufficienti.

Per la generazione di ricette, il prompt richiede una singola ricetta concreta, con ingredienti, quantità, istruzioni, durata, porzioni, difficoltà, calorie e macronutrienti. Viene inoltre richiesto di privilegiare gli ingredienti presenti in dispensa, soprattutto quelli con scadenza vicina, e di evitare ricette troppo simili a quelle già generate nella sessione. La risposta viene richiesta in formato JSON, così da poter essere salvata, mostrata nell'interfaccia e applicata successivamente alla dieta.

Per l'analisi dei pasti, il prompt chiede di convertire una descrizione libera in un insieme di componenti alimentari con quantità, calorie, proteine, carboidrati, grassi, confidence e fonte stimata. I riferimenti provenienti da FoodData Central o Open Food Facts vengono usati solo quando pertinenti. La nota destinata all'utente non deve nominare i dataset tecnici, perché l'interfaccia presenta il risultato come analisi AI e lascia all'utente la possibilità di confermare o correggere.

Per le immagini, il modello viene usato in due momenti diversi: riconoscimento visivo e strutturazione testuale. Nel caso della dispensa, una foto di prodotti, spesa o scontrino viene trasformata in una bozza modificabile di elementi da salvare. Nel caso della dieta, una foto del pasto viene trasformata in una descrizione alimentare, poi analizzata dal flusso nutrizionale. Questa separazione aiuta a mantenere più controllabile il processo: prima si interpreta l'immagine, poi si stimano i valori.

## 6.8 Output strutturati, normalizzazione e fallback

Uno dei problemi principali nell'uso di modelli generativi all'interno di una web app è la trasformazione di risposte linguistiche in dati utilizzabili. Una ricetta scritta come testo libero può essere utile per la lettura, ma non è immediatamente collegabile a dieta, dispensa, storico o salvataggio. Per questo il prototipo richiede, quando possibile, output strutturati in JSON.

La generazione strutturata permette al backend di verificare la presenza dei campi principali, normalizzare valori numerici, controllare liste di ingredienti e istruzioni, e costruire oggetti coerenti con lo stato applicativo. Se il modello restituisce un formato non valido o incompleto, il sistema applica controlli di parsing e fallback. La robustezza non dipende quindi solo dal prompt, ma dalla combinazione tra istruzioni al modello, validazione applicativa e possibilità di correzione da parte dell'utente.

I fallback svolgono una funzione essenziale anche quando una fonte esterna non risponde. Se Open Food Facts non restituisce un prodotto, se FoodData Central non è configurato o se l'AI non produce un output utilizzabile, il sistema deve degradare in modo comprensibile. Questo significa mantenere l'inserimento manuale, mostrare messaggi chiari e impedire che dati parziali vengano salvati senza controllo. In un prototipo che tratta informazioni nutrizionali e personali, la gestione dell'errore è parte della qualità progettuale.

## 6.9 Limiti e sviluppi futuri

L'integrazione di dataset e prompt engineering non elimina i limiti dell'Intelligenza Artificiale nel dominio alimentare. Le stime nutrizionali possono restare approssimative, soprattutto quando le quantità sono ambigue, gli alimenti non sono riconoscibili o le informazioni disponibili sono incomplete. Inoltre, le fonti aperte possono contenere record non aggiornati o non uniformi. Per questi motivi, NutriTrack non deve essere presentato come strumento medico o dietetico prescrittivo, ma come supporto alla consapevolezza e alla gestione quotidiana.

Un primo sviluppo futuro riguarda una pipeline RAG completa. I record Open Food Facts, FoodData Central, Compendium e un eventuale dataset di ricette potrebbero essere indicizzati tramite embedding o ricerca full-text, associando a ogni risultato metadati di provenienza, qualità e data di aggiornamento. Il modello riceverebbe così un insieme di documenti recuperati in modo più sistematico, con riferimenti più precisi e valutabili.

Un secondo sviluppo riguarda la validazione nutrizionale. Le ricette generate potrebbero essere ricontrollate attraverso calcoli deterministici sugli ingredienti, invece di affidare interamente la stima finale al modello. Analogamente, l'analisi dei pasti potrebbe distinguere meglio tra valori recuperati da dataset, stime da porzione standard e correzioni manuali dell'utente. Nell'interfaccia, tuttavia, tale complessità dovrebbe essere presentata in modo semplice, mantenendo chiaro che l'utente conserva il controllo finale.

Infine, l'uso dei MET potrebbe essere raffinato attraverso dati provenienti da dispositivi indossabili o provider reali. Il prototipo già prevede una modellazione separata dei dispositivi, ma l'integrazione effettiva con bilance o tracker richiederebbe gestione dei permessi, sincronizzazione sicura, risoluzione dei conflitti e valutazione della qualità del dato. Anche in questo caso, la direzione progettuale rimane la stessa: integrare fonti diverse senza trasformare l'automazione in una decisione opaca.

## Fonti da citare

- Open Food Facts API e documentazione prodotto: https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/
- Open Food Facts data export: https://world.openfoodfacts.org/data
- USDA FoodData Central API Guide: https://fdc.nal.usda.gov/api-guide/
- Compendium of Physical Activities, progetto ufficiale: https://pacompendium.com/
- 2024 Adult Compendium: https://pacompendium.com/adult-compendium/
- 2024 Older Adult Compendium: https://pacompendium.com/older-adult-compendium/
- Corrected METs: https://pacompendium.com/corrected-mets/
