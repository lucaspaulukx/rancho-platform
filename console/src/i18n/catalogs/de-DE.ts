export const deDE = {
  'workloadsPage.noServices': 'Keine Dienste in diesem Kontext',
  'workloadsPage.noContainers': 'Keine Container in diesem Kontext',
  'workloadsPage.emptyDescription': 'Prüfen Sie die gewählte Umgebung und die Filter.',
  'workloadsPage.service': 'Dienst',
  'workloadsPage.container': 'Container',
  'workloadsPage.state': 'Status',
  'workloadsPage.stack': 'Stack',
  'workloadsPage.noStack': 'Kein Stack',
  'workloadsPage.image': 'Image',
  'workloadsPage.scale': 'Container / Skalierung',
  'workloadsPage.host': 'Host',
  'workloadsPage.details': 'Details',
  'workloadsPage.refresh': 'Inventar aktualisieren',
  'workloadsPage.searchStack': 'Stacks suchen',
  'workloadsPage.searchPlaceholder': 'Name, Beschreibung oder ID…',
  'workloadsPage.allStacks': 'Alle Stacks',
  'workloadsPage.allStates': 'Alle Status',
  'workloadsPage.includeInfra': 'Infrastruktur einbeziehen',
  'workloadsPage.unavailableStack':
    'Der gewählte Stack ist in dieser Umgebung nicht vorhanden oder für Ihr Konto nicht verfügbar.',
  'workloadsPage.infraStack': 'Infrastruktur-Stack',
  'workloadsPage.appStack': 'Anwendungs-Stack',
  'workloadsPage.unknownHealth': 'nicht gemeldet',
  'workloadsPage.noStacks': 'Kein Stack entspricht diesem Filter',
  'workloadsPage.noStacksDescription':
    'Prüfen Sie die Filter oder erstellen Sie einen Stack in dieser Umgebung.',
  'workloadsPage.stackResources': 'Ressourcen des Stacks',
  'workloadsPage.serviceContainers': 'Container des Dienstes',
  'workloadsPage.services': 'Dienste',
  'workloadsPage.containers': 'Container',
  'workloadsPage.health': 'Zustand: {state}',
  'workloadsPage.open': '{name} öffnen',
  'workloadsPage.openStack': 'Stack {name} öffnen',
  'workloadsPage.inventorySummary': '{stacks} Stacks · {services} Dienste · {containers} Container',
  'workloadsPage.servicesTab': 'Dienste ({count})',
  'workloadsPage.containersTab': 'Container ({count})',
  'resourceValidation.memoryFormat':
    'Geben Sie einen nichtnegativen Speicherwert ohne Exponentialschreibweise ein.',
  'resourceValidation.memoryRange': 'Der Speicherwert liegt außerhalb der zulässigen Grenzen.',
  'resourceValidation.memoryBytes':
    'Der Speicherwert muss in ganzen Bytes im sicheren Wertebereich liegen.',
  'resourceValidation.depth': 'Die Konfiguration ist zu tief verschachtelt.',
  'resourceValidation.memoryValues':
    'Speicher und Reservierung müssen in nichtnegativen ganzen Bytes angegeben werden.',
  'resourceValidation.memoryReservation':
    'Die Speicherreservierung darf das Limit nicht überschreiten.',
  'resourceValidation.limitInteger':
    'Geben Sie eine ganze Zahl von -1 bis 2147483647 ein. -1 bedeutet unbegrenzt.',
  'resourceValidation.limitRange':
    'Das Limit liegt außerhalb des von dieser Rancher-Instanz akzeptierten Bereichs.',
  'resourceValidation.limitCount': 'Konfigurieren Sie bis zu 32 Prozesslimits.',
  'resourceValidation.limitFormat': 'Die Liste der Prozesslimits hat ein inkompatibles Format.',
  'resourceValidation.limitNames': 'Wählen Sie bekannte Limitnamen ohne Duplikate.',
  'resourceValidation.limitOrder': 'Das weiche Limit darf das harte Limit nicht überschreiten.',
  'resourceValidation.limitContract':
    'Der aktuelle API-Vertrag erlaubt keine Konfiguration von Prozesslimits.',
  'composeValidation.createUnavailable': 'Stacks können derzeit nicht erstellt werden.',
  'composeValidation.nameRequired': 'Geben Sie den Namen des Stacks ein.',
  'composeValidation.dockerRequired': 'Füllen Sie Docker Compose aus.',
  'composeValidation.fileTooLarge': '{label} akzeptiert bis zu 512 KiB in UTF-8.',
  'composeValidation.nullCharacter': '{label} enthält ein Nullzeichen.',
  'composeValidation.variableName':
    'Jede Variable benötigt einen gültigen Namen, zum Beispiel APP_PORT.',
  'composeValidation.duplicateVariable': 'Doppelte Variable: {name}.',
  'composeValidation.createChanged': 'Stacks können nicht mehr erstellt werden.',
  'composeValidation.fieldChanged':
    'Rancher erlaubt die Eingabe von {name} nicht mehr. Öffnen Sie das Panel erneut.',

  'composeEditor.hideLabel': '{label} ausblenden',
  'composeEditor.showLabel': '{label} anzeigen',
  'composeEditor.size': '{lines} Zeile(n) · {bytes} Byte',
  'composeEditor.hide': 'Ausblenden',
  'composeEditor.show': 'Anzeigen',
  'composeEditor.hint':
    'Der Inhalt wird ohne Konvertierung an Rancher gesendet. Höchstens 512 KiB in UTF-8.',
  'composeEditor.hidden':
    'Der Inhalt ist ausgeblendet. Wählen Sie „Anzeigen“, um ihn zu bearbeiten.',
  'composeEditor.stackName': 'Stack-Name',
  'composeEditor.nameHint': 'Buchstaben, Zahlen und Bindestriche. Höchstens 63 Zeichen.',
  'composeEditor.description': 'Beschreibung',
  'composeEditor.creationMode': 'Methode zur Stack-Erstellung',
  'composeEditor.docker': 'Docker Compose',
  'composeEditor.rancher': 'Rancher Compose (optional)',
  'composeEditor.start': 'Dienste nach dem Import starten',
  'composeEditor.startDescription':
    'Erstellt Container in der ausgewählten Umgebung. Lassen Sie die Option deaktiviert, um die Dienste vor dem Start zu prüfen.',
  'composeEditor.startWarning':
    'Beim Import können Container erstellt und Ressourcen in der ausgewählten Umgebung belegt werden.',
  'composeEditor.startManually':
    'Die Dienste werden importiert und nicht automatisch gestartet. Sie können sie mit der Aktion „Starten“ starten.',
  'composeEditor.empty': 'Leerer Stack',
  'composeEditor.import': 'Compose importieren',
  'composeEditor.compatibility':
    'Verwenden Sie ein mit Rancher 1.6 kompatibles Format. Der Server validiert die Dateien und führt den Import aus. Verfolgen Sie das Ergebnis im Stack.',
  'composeEditor.variables': 'Variablen für die Interpolation',
  'composeEditor.variablesNote':
    'Rancher verwendet diese Werte beim Import der Dateien. Sie werden nicht in den Konsoleneinstellungen gespeichert.',
  'composeEditor.addVariable': 'Variable hinzufügen',
  'composeEditor.emptyHint':
    'Erstellen Sie den Stack und fügen Sie über das Menü seiner Zeile Dienste hinzu.',
  'composeEditor.variableName': 'Variablenname {index}',
  'composeEditor.variableValue': 'Variablenwert {index}',
  'composeEditor.removeVariable': 'Variable {index} entfernen',
  'composeEditor.review': 'Prüfen Sie den Stack.',

  'serviceEditors.linkError.environment': 'Der Dienst gehört nicht zur Umgebung.',
  'serviceEditors.linkError.foreign': 'Einige Verknüpfungen gehören zu einer anderen Umgebung.',
  'serviceEditors.linkError.changed':
    'Ein anderer Client hat die Verknüpfungen geändert. Schließen und öffnen Sie das Panel erneut.',
  'serviceEditors.linkError.advanced':
    'Einige Verknüpfungen sind erweitert, im Übergang oder verweisen auf nicht verfügbare Ziele. Verwenden Sie das native Formular, um diese Konfiguration zu erhalten.',
  'serviceEditors.linkError.unavailable':
    'In diesem Kontext können Verknüpfungen nicht bearbeitet werden.',
  'serviceEditors.linkError.limit': 'Bearbeiten Sie bis zu 100 Verknüpfungen pro Vorgang.',
  'serviceEditors.linkError.contract':
    'Der Verknüpfungsvertrag hat sich geändert. Öffnen Sie das Panel erneut.',
  'serviceEditors.linkError.stack':
    'Der Stack des Dienstes ist für diesen Vorgang nicht verfügbar.',
  'serviceEditors.linkError.target':
    'Wählen Sie in dieser Umgebung einen verfügbaren Anwendungsdienst, der sich vom Quelldienst unterscheidet.',
  'serviceEditors.linkError.alias':
    'Ungültiger Alias. Verwenden Sie Buchstaben, Zahlen, Bindestriche, Punkte oder Unterstriche.',
  'serviceEditors.linkError.duplicate':
    'Ziele und Aliase dürfen in der Liste nicht mehrfach vorkommen.',
  'serviceEditors.unsupported': 'Diese Verknüpfungen können nicht bearbeitet werden.',
  'serviceEditors.reopen': 'Öffnen Sie den Verknüpfungseditor erneut.',
  'serviceEditors.contract': 'Der Vertrag für Dienstverknüpfungen ist nicht verfügbar.',
  'serviceEditors.changed':
    'Der Verknüpfungsvertrag hat sich geändert. Öffnen Sie das Panel erneut.',
  'serviceEditors.confirmRemove': 'Bestätigen Sie das Entfernen aller Verknüpfungen.',
  'serviceEditors.sent':
    'Die Verknüpfungen wurden an Rancher gesendet. Verfolgen Sie die Konfiguration und die Topologie.',
  'serviceEditors.reviewLinks': 'Prüfen Sie die Verknüpfungen.',
  'serviceEditors.close': 'Schließen',
  'serviceEditors.review': 'Änderungen prüfen',
  'serviceEditors.linkInfo':
    'Wählen Sie die Dienste, die diese Anwendung verwendet. Der optionale Alias identifiziert das Ziel in der nativen Konfiguration. Änderungen an der Liste können die Namensauflösung und die Konnektivität beeinflussen.',
  'serviceEditors.denied':
    'Ihr Konto oder der aktuelle Zustand erlaubt keine Änderung der Verknüpfungen.',
  'serviceEditors.empty': 'Dieser Dienst hat keine ausgehenden Verknüpfungen.',
  'serviceEditors.select': 'Dienst auswählen…',
  'serviceEditors.aliasHint': 'Optional. Ohne Alias verwendet Rancher den Dienstnamen.',
  'serviceEditors.add': 'Verknüpfung hinzufügen',
  'serviceEditors.acknowledge':
    'Ich bestätige, dass alle Verknüpfungen dieses Dienstes entfernt werden sollen',
  'serviceEditors.apply': 'Dienstverknüpfungen anwenden?',
  'serviceEditors.serviceName': 'Dienstname',
  'serviceEditors.discard': 'Ungespeicherte Verknüpfungen verwerfen?',
  'serviceEditors.discardDescription': 'Die Rancher-Konfiguration bleibt unverändert.',
  'serviceEditors.context': 'Kontext wechseln?',
  'serviceEditors.contextDescription':
    'Es gibt ungespeicherte Verknüpfungen. Warten Sie, bis eine laufende Übermittlung abgeschlossen ist.',
  'serviceEditors.link': 'Verknüpfung {index}',
  'serviceEditors.remove': 'Verknüpfung {index} entfernen',
  'serviceEditors.target': 'Zieldienst {index}',
  'serviceEditors.alias': 'Verknüpfungsalias {index}',
  'serviceEditors.targetMissing': 'Ziel nicht verfügbar ({id})',
  'serviceEditors.title': 'Verknüpfungen · {name}',
  'serviceEditors.environment': 'Umgebung: {name}',
  'serviceEditors.applyDescription':
    'Die Liste für {name} wird nur in {environment} ersetzt. Neue Anzahl der Verknüpfungen: {count}.',
  'serviceEditors.before': 'Vorher · Anzahl der Verknüpfungen: {count}',
  'serviceEditors.after': 'Nachher · Anzahl der Verknüpfungen: {count}',
  'serviceEditors.summary': '{target} · Alias: {alias}',
  'serviceEditors.scaleError.integer': 'Geben Sie eine ganzzahlige Containeranzahl ein.',
  'serviceEditors.scaleError.range': 'Der Wert liegt außerhalb des von Rancher erlaubten Bereichs.',
  'serviceEditors.scaleError.unavailable':
    'Die Skalierung ist für diese Ressource nicht verfügbar.',
  'serviceEditors.scaleError.changed':
    'Ein anderer Client hat die Skalierung geändert. Öffnen Sie das Panel erneut, um den aktuellen Wert zu laden.',
  'serviceEditors.scaleError.unchanged':
    'Geben Sie einen anderen Skalierungswert als den aktuellen ein.',
  'serviceEditors.confirmZero':
    'Bestätigen Sie das Stoppen der Container, bevor Sie auf 0 skalieren.',
  'serviceEditors.reviewScale': 'Prüfen Sie die Skalierung.',
  'serviceEditors.quantity': 'Gewünschte Containeranzahl',
  'serviceEditors.scaleInfo':
    'Rancher passt die tatsächliche Skalierung des Dienstes an. Eine Verringerung kann Container stoppen. Eine Erhöhung hängt von der verfügbaren Kapazität ab. Es kann dauern, bis die Anzahl der laufenden Container den konfigurierten Wert erreicht.',
  'serviceEditors.acknowledgeZero':
    'Ich verstehe, dass eine Skalierung auf 0 die Container dieses Dienstes stoppt',
  'serviceEditors.templateHint':
    'Die Antworten der Katalogvorlage bleiben bei diesem Vorgang erhalten.',
  'serviceEditors.currentScale': 'Aktuell konfigurierte Skalierung: {scale}.',

  'stackComposeUpgradePanel.dockerCompose': 'Docker Compose',
  'stackComposeUpgradePanel.rancherCompose': 'Rancher Compose',
  'stackComposeUpgradePanel.impact':
    'Ich verstehe, dass die Aktualisierung Dienste starten und Container ersetzen kann',
  'stackComposeUpgradePanel.reviewTitle': 'Stack mit Compose aktualisieren?',
  'stackComposeUpgradePanel.reviewDescription':
    'Die Dateien sind während der Prüfung ausgeblendet. Der Stack und sein Export werden vor der Übermittlung erneut geprüft. Vorhandene Parameter bleiben erhalten. Der Server validiert das YAML und führt die Aktualisierung aus.',
  'stackComposeUpgradePanel.discardTitle': 'Compose-Änderungen verwerfen?',
  'stackComposeUpgradePanel.discardDescription':
    'Die bearbeiteten Dateien wurden noch nicht an Rancher gesendet.',
  'stackComposeUpgradePanel.leaveTitle': 'Mit ausstehenden Compose-Änderungen verlassen?',
  'stackComposeUpgradePanel.leaveDescription':
    'Die Dateien wurden noch nicht gesendet. Warten Sie, bis eine laufende Aktualisierung abgeschlossen ist.',
  'stackComposeUpgradePanel.close': 'Schließen',
  'stackComposeUpgradePanel.review': 'Aktualisierung prüfen',
  'stackComposeUpgradePanel.warning':
    'Eine Compose-Aktualisierung kann Dienste starten und Container neu erstellen. Rancher behält die Skalierung vorhandener Dienste bei. Verwenden Sie „Dienst skalieren“, um sie zu ändern. Neue Dienste können selbst mit scale: 0 in der Datei mit einer Instanz starten. Der Export ist keine vollständige Sicherung der Umgebung. Prüfen Sie die Skalierung und die Dateien, bevor Sie fortfahren.',
  'stackComposeUpgradePanel.title': 'Compose aktualisieren · {name}',
  'stackComposeUpgradePanel.description':
    'Umgebung: {name}. Dateien aus der aktuellen Konfiguration exportiert.',
  'stackComposeUpgradePanel.saved':
    'Aktualisierung entgegengenommen. Verfolgen Sie den Stack und schließen Sie die Aktualisierung mit den nativen Aktionen ab oder setzen Sie sie zurück.',
  'stackComposeUpgradePanel.unavailable':
    'Der Compose-Editor ist für diesen Stack nicht verfügbar.',
  'stackComposeUpgradePanel.permission':
    'Ihre Berechtigung zum Exportieren oder Aktualisieren ist nicht verfügbar.',
  'stackComposeUpgradePanel.loadFailed': 'Compose ist nicht verfügbar.',
  'stackComposeUpgradePanel.reopen': 'Öffnen Sie den Compose-Editor erneut.',
  'stackComposeUpgradePanel.requestFailed':
    'Der Compose-Vorgang konnte nicht abgeschlossen werden.',
  'stackComposeUpgradePanel.httpError':
    'Compose-Vorgang nicht abgeschlossen (HTTP {status}). Prüfen Sie die Datei oder die Prozesse des Stacks.',
  'stackComposeUpgradePanel.validation.stackUnavailable':
    'Der Stack ist in dieser Umgebung oder diesem Zustand nicht verfügbar.',
  'stackComposeUpgradePanel.validation.noSource':
    'Dieser Stack hat keine Compose-Quelle. Verwenden Sie die Diensteditoren.',
  'stackComposeUpgradePanel.validation.actionUnavailable': 'Die Stack-Aktion ist nicht verfügbar.',
  'stackComposeUpgradePanel.validation.invalidTarget': 'Ungültiges Ziel der Stack-Aktion.',
  'stackComposeUpgradePanel.validation.invalidExport': 'Ungültiger Compose-Export.',
  'stackComposeUpgradePanel.validation.exportTooLarge':
    'Der Export überschreitet das Limit von 512 KiB pro Datei.',
  'stackComposeUpgradePanel.validation.confirmImpact':
    'Bestätigen Sie die Auswirkungen der Stack-Aktualisierung.',
  'stackComposeUpgradePanel.validation.contractUnavailable':
    'Der Vertrag für die Stack-Aktualisierung ist nicht verfügbar.',
  'stackComposeUpgradePanel.validation.stackChanged':
    'Der Stack oder seine Dienste wurden geändert. Öffnen Sie den Editor erneut.',
  'stackComposeUpgradePanel.validation.changeRequired':
    'Ändern Sie vor der Übermittlung eine Compose-Datei.',
  'stackComposeUpgradePanel.validation.fieldDenied': 'Das Compose-Feld ist nicht zulässig.',
  'stackComposeUpgradePanel.validation.invalidFiles':
    'Prüfen Sie die Compose-Dateien und das UTF-8-Limit von 512 KiB.',
  'stackComposeUpgradePanel.validation.preserveParameters':
    'Die aktuellen Parameter können mit diesem Vertrag nicht erhalten werden.',
  'stackComposeUpgradePanel.validation.invalidParameter':
    'Ein Stack-Parameter liegt außerhalb des Vertrags.',

  'serviceUpgradeForm.validation.contract': 'Der Aktualisierungsvertrag ist nicht verfügbar.',
  'serviceUpgradeForm.validation.sidecarContract': 'Der Sidecar-Vertrag ist nicht verfügbar.',
  'serviceUpgradeForm.validation.image': 'Geben Sie ein gültiges Image ohne Leerzeichen ein.',
  'serviceUpgradeForm.validation.batch':
    'Die Stapelgröße muss eine ganze Zahl von mindestens 1 sein.',
  'serviceUpgradeForm.validation.interval':
    'Das Intervall muss eine ganze Zahl von mindestens 100 ms sein.',
  'serviceUpgradeForm.validation.order': 'Prüfen Sie die Reihenfolge der Aktualisierung.',
  'serviceUpgradeForm.validation.differentImage': 'Wählen Sie ein anderes Image als das aktuelle.',
  'serviceUpgradeForm.validation.health': 'Prüfen Sie die Zustandsprüfung.',
  'serviceUpgradeForm.validation.healthContract':
    'Der Vertrag für die Zustandsprüfung ist nicht verfügbar.',
  'serviceUpgradeForm.validation.ulimitContract':
    'Der Vertrag für Prozesslimits ist nicht verfügbar.',
  'serviceUpgradeForm.validation.securityContract': 'Prüfen Sie den Sicherheitsvertrag.',
  'serviceUpgradeForm.validation.memory':
    'Geben Sie ein Limit und eine Reservierung ein. Mit 0 entfernen Sie einen expliziten Wert.',
  'serviceUpgradeForm.validation.cpuContract': 'Der Vertrag für CPU und E/A ist nicht verfügbar.',
  'serviceUpgradeForm.validation.schedulingContract':
    'Der Platzierungsvertrag ist nicht verfügbar.',
  'serviceUpgradeForm.validation.sidecarUpgradeContract':
    'Der Vertrag für die Sidecar-Aktualisierung ist nicht verfügbar.',
  'serviceUpgradeForm.review': 'Prüfen Sie die Aktualisierung.',
  'serviceUpgradeForm.limitsNotice':
    'Änderungen an den Limits ersetzen die Dienstcontainer. Eine leere Liste entfernt explizite Limits und übernimmt die Docker-Standardwerte.',
  'serviceUpgradeForm.securityNotice':
    'Sicherheitsänderungen ersetzen die Dienstcontainer. Prüfen Sie Capabilities, Host-Zugriff und Dateisystemeinstellungen vor der Bestätigung.',
  'serviceUpgradeForm.batchNotice':
    'Pro Stapel werden bis zu {batch} Container aktualisiert. Zwischen den Stapeln liegen {interval} ms. Ports, Variablen, Volumes und Sidecars behalten ihre Einstellungen, sofern Sie diese oben nicht ausdrücklich geändert haben. Die Verfügbarkeit hängt von der Kapazität und dem Zustand der Anwendung ab.',
  'serviceUpgradeForm.follow':
    'Verfolgen Sie hier nach der Aktualisierung den Status. „Aktualisierung abschließen“ und „Aktualisierung zurücksetzen“ erscheinen, sobald Rancher diese Aktionen bereitstellt.',
  'serviceUpgradeForm.impact':
    'Dienst {service}. Veröffentlichte Ports können den Zugriff ändern. Änderungen an Einbindungen können vorhandene Daten unzugänglich machen. Änderungen an Sidecars oder deren Entfernung ersetzen Hilfscontainer und können Daten oder das Netzwerk beeinflussen. Zustandsprüfungen können Container neu erstellen oder die Aktualisierung unterbrechen, wenn der Endpunkt ausfällt. Rancher ersetzt Container gemäß der gewählten Strategie. Prüfen Sie die Felder vor der Bestätigung.',
  'serviceUpgradeForm.image': 'Neues Image',
  'serviceUpgradeForm.bindings': 'Ports und Volumes bei dieser Aktualisierung bearbeiten',
  'serviceUpgradeForm.health': 'Zustandsprüfung bei dieser Aktualisierung bearbeiten',
  'serviceUpgradeForm.sidecars': 'Sidecars bei dieser Aktualisierung bearbeiten',
  'serviceUpgradeForm.ulimits': 'Prozesslimits bei dieser Aktualisierung bearbeiten',
  'serviceUpgradeForm.security': 'Sicherheit bei dieser Aktualisierung bearbeiten',
  'serviceUpgradeForm.privileged': 'Privilegierter Modus',
  'serviceUpgradeForm.readOnly': 'Schreibgeschütztes Dateisystem',
  'serviceUpgradeForm.memory': 'Arbeitsspeicher bei dieser Aktualisierung bearbeiten',
  'serviceUpgradeForm.memoryLimit': 'Arbeitsspeicherlimit',
  'serviceUpgradeForm.memoryReservation': 'Arbeitsspeicherreservierung',
  'serviceUpgradeForm.cpu': 'CPU und E/A bei dieser Aktualisierung bearbeiten',
  'serviceUpgradeForm.affinity': 'Affinitäten bei dieser Aktualisierung bearbeiten',
  'serviceUpgradeForm.batch': 'Container pro Stapel',
  'serviceUpgradeForm.interval': 'Intervall zwischen Stapeln (ms)',
  'serviceUpgradeForm.configuration': 'Konfigurationsaktualisierung',
  'serviceUpgradeForm.imageUpgrade': 'Image-Aktualisierung',
  'serviceUpgradeForm.currentImage': 'Aktuelles Image:',
  'serviceUpgradeForm.capAdd': 'Hinzugefügte Capabilities',
  'serviceUpgradeForm.capDrop': 'Entfernte Capabilities',
  'serviceUpgradeForm.startFirst': 'Neue Container starten, bevor die aktuellen gestoppt werden',
  'serviceUpgradeForm.confirm': 'Dienstkonfiguration aktualisieren?',
  'sidecarValidation.depth': 'Die Sidecar-Konfiguration hat zu viele Verschachtelungsebenen.',
  'sidecarValidation.fieldUnavailable':
    'Das Sidecar-Feld {name} ist nicht verfügbar. Öffnen Sie das Panel erneut.',
  'sidecarValidation.reviewItems': 'Prüfen Sie die Einträge der Sidecar-Konfiguration.',
  'sidecarValidation.fieldContract': 'Der Sidecar-Vertrag für {name} ist nicht verfügbar.',
  'sidecarValidation.limit': 'Verwenden Sie eine Liste mit höchstens 50 Sidecars.',
  'sidecarValidation.contract': 'Der Sidecar-Vertrag ist nicht verfügbar.',
  'sidecarValidation.review': 'Prüfen Sie die Sidecar-Konfiguration.',
  'sidecarValidation.name':
    'Verwenden Sie eindeutige Sidecar-Namen, die sich vom Dienstnamen unterscheiden und höchstens 63 Buchstaben, Ziffern oder Bindestriche enthalten.',
  'sidecarValidation.image': 'Geben Sie ein gültiges Image für Sidecar {name} ein.',
  'sidecarValidation.reservedImage':
    'Dieses Image ist für den Rancher-Vertrag zum Entfernen reserviert. Verwenden Sie „Sidecar entfernen“.',
  'sidecarValidation.networkMode':
    'Verwenden Sie den Netzwerkmodus container, um das Netzwerk eines anderen Containers dieses Dienstes zu nutzen.',
  'sidecarValidation.links':
    'Prüfen Sie die Netzwerk- und Volume-Verknüpfungen zwischen den Containern des Dienstes.',
  'sidecarValidation.cycle':
    'Netzwerk- und Volume-Verknüpfungen zwischen Sidecars dürfen keine Zyklen bilden.',
  'workloadPolicyValidation.limit': 'Verwenden Sie höchstens 100 Affinitätsregeln.',
  'workloadPolicyValidation.rule':
    'Geben Sie gültige Schlüssel und Werte für Affinitätsregeln ein. Kommas und Zeilenumbrüche sind unzulässig.',
  'workloadPolicyValidation.map': 'Ungültige Platzierungs-Labels.',
  'workloadPolicyValidation.text': 'Labels müssen Text enthalten.',
  'workloadPolicyValidation.global':
    'Die globale Platzierung akzeptiert nur Host-Labels mit zwingenden Regeln oder Ausschlussregeln.',
  'workloadPolicyValidation.depth': 'Die Konfiguration hat zu viele Verschachtelungsebenen.',
  'workloadPolicyValidation.capabilities':
    'Prüfen Sie die Sicherheits-Capabilities anhand des aktuellen Vertrags.',

  'bindingsEditor.portsTitle': 'Veröffentlichte Ports',
  'bindingsEditor.volumesTitle': 'Volumes',
  'bindingsEditor.portsHint':
    'Legen Sie den Containerport und optional den Host-Port und die IP-Adresse fest. Rancher veröffentlicht den Port.',
  'bindingsEditor.volumesHint':
    'Binden Sie ein benanntes Volume, einen Host-Pfad oder ein anonymes Volume unter einem absoluten Zielpfad im Container ein.',
  'bindingsEditor.unsupported':
    'Das erhaltene Format wird nicht unterstützt. Verwenden Sie das native Formular, um die Konfiguration zu erhalten.',
  'bindingsEditor.native':
    'Der native Eintrag bleibt erhalten. Änderungen an anderen Zeilen konvertieren diesen Wert nicht.',
  'bindingsEditor.readWrite': 'Lesen und schreiben',
  'bindingsEditor.readOnly': 'Nur lesen',
  'bindingsEditor.hostPortHint': 'Optional. Es gilt die native Portzuweisung von Rancher.',
  'bindingsEditor.ipHint':
    'Optional. Erfordert einen Host-Port. IPv4 oder IPv6 ohne Klammern sind zulässig.',
  'bindingsEditor.sourceHint': 'Volumename, absoluter Host-Pfad oder leer für ein anonymes Volume.',
  'bindingsEditor.targetHint': 'Absoluter Pfad im Container, zum Beispiel /data.',
  'bindingsEditor.containerPort': 'Containerport {index}',
  'bindingsEditor.hostPort': 'Host-Port {index}',
  'bindingsEditor.protocol': 'Portprotokoll {index}',
  'bindingsEditor.ip': 'Veröffentlichte IP-Adresse {index}',
  'bindingsEditor.source': 'Volumequelle {index}',
  'bindingsEditor.target': 'Volumeziel {index}',
  'bindingsEditor.access': 'Volumezugriff {index}',
  'bindingsEditor.portRow': 'Port {index}',
  'bindingsEditor.volumeRow': 'Volume {index}',
  'bindingsEditor.removePort': 'Port {index} entfernen',
  'bindingsEditor.removeVolume': 'Volume {index} entfernen',
  'bindingsEditor.addPort': 'Port hinzufügen',
  'bindingsEditor.addVolume': 'Volume hinzufügen',
  'bindingsEditor.validation.limit': 'Verwenden Sie höchstens 100 native Einträge pro Feld.',
  'bindingsEditor.validation.ports':
    'Prüfen Sie, ob die Ports ganze Zahlen von 1 bis 65535 sind und ob das Protokoll und die veröffentlichte IP-Adresse gültig sind.',
  'bindingsEditor.validation.volumes':
    'Prüfen Sie die Quelle, den absoluten Zielpfad und den Zugriffsmodus jedes Volumes.',
  'bindingsEditor.validation.ipNeedsHostPort':
    'Eine veröffentlichte IP-Adresse erfordert einen Host-Port.',
  'bindingsEditor.validation.portConflict':
    'Für denselben Host-Port und dasselbe Protokoll gibt es widersprüchliche Zuordnungen.',
  'bindingsEditor.validation.duplicateTarget':
    'Verwenden Sie für jedes Volume ein anderes Einbindungsziel.',
  'bindingsEditor.validation.depth': 'Die Konfiguration ist zu tief verschachtelt.',

  'deviceUpgradeForm.edit': 'Geräte bei diesem Upgrade bearbeiten',
  'deviceUpgradeForm.impact':
    'Eine Änderung der Gerätezuordnungen ersetzt die Dienstcontainer und kann den Zugriff auf Host-Geräte ändern. Wenn Sie alle Zeilen entfernen, entfallen die expliziten Zuordnungen. Die Standardgeräte der Laufzeitumgebung und andere Starteinstellungen bleiben erhalten.',
  'deviceUpgradeForm.reset': 'Alle expliziten Zuordnungen entfernen',
  'deviceUpgradeForm.confirmTitle': 'Geräte des Dienstes aktualisieren?',
  'deviceUpgradeForm.confirmDescription':
    'Dienst {service}. Änderungen an den Gerätezuordnungen ändern den Zugriff auf Host-Geräte und ersetzen die Dienstcontainer. Eine leere Liste entfernt explizite Zuordnungen. Die Standardgeräteberechtigungen der Laufzeitumgebung bleiben erhalten. Andere für dieses Upgrade ausgewählte Optionen können Ports, Einbindungen, Sidecars und den Zustand beeinflussen. Prüfen Sie vor dem Bestätigen alle ausgewählten Änderungen.',

  'deviceUpgrade.error.unavailable':
    'Das Geräte-Upgrade ist für den aktuellen Dienst, Geltungsbereich oder nativen Vertrag nicht verfügbar.',
  'deviceUpgrade.error.conflict':
    'Die Startkonfiguration oder die Sidecars wurden in einem anderen Client geändert. Öffnen Sie das Geräte-Upgrade erneut.',
  'deviceUpgrade.error.noChange':
    'Ändern Sie das Image oder die ausgewählte Konfiguration, bevor Sie die Gerätezuordnungen aktualisieren.',
  'deviceUpgrade.error.disabled': 'Upgrades von Gerätezuordnungen sind deaktiviert.',

  'devices.title': 'Gerätezuordnungen',
  'devices.description':
    'Ordnen Sie Geräte zu, die bereits auf dem ausgewählten Host vorhanden sind. Die Berechtigungen gelten für neue Container. Auf dem Host wird kein Gerät erstellt und der privilegierte Modus bleibt unverändert.',
  'devices.effectivePermissions':
    'Die angeforderten r/w/m-Berechtigungen ersetzen die Standardgeräteberechtigungen der Laufzeitumgebung nicht. Prüfen Sie den tatsächlichen Zugriff auf dem Zielhost. Eine schreibgeschützte Zuordnung eines bereits freigegebenen Geräts kann weiterhin Schreibzugriff erlauben.',
  'devices.row': 'Gerät {index}',
  'devices.host': 'Host-Pfad {index}',
  'devices.container': 'Containerpfad {index}',
  'devices.pathHint':
    'Verwenden Sie einen expliziten absoluten Pfad. Auf dem Host muss ein kompatibles Gerät vorhanden sein.',
  'devices.read': 'Gerät {index}: lesen (r)',
  'devices.write': 'Gerät {index}: schreiben (w)',
  'devices.mknod': 'Gerät {index}: Geräteknoten erstellen (m)',
  'devices.add': 'Gerät hinzufügen',
  'devices.remove': 'Gerät {index} entfernen',
  'devices.rawValue': 'Nativer Wert von Gerät {index}',
  'devices.legacy':
    'Dieser native Wert bleibt unverändert im Entwurf erhalten. Dieser Editor kann ihn nicht übermitteln. Öffnen Sie das native Formular erneut, um dieses Format zu übermitteln, oder entfernen Sie diese Zeile ausdrücklich.',
  'devices.incompatible':
    'Diese Geräteliste liegt in einem inkompatiblen Altformat vor oder überschreitet das Limit des Editors. Verwenden Sie den nativen Editor, um die Liste zu erhalten.',
  'devices.error.list': 'Konfigurieren Sie eine Liste mit höchstens 32 Gerätezuordnungen.',
  'devices.error.format':
    'Geben Sie für jede Gerätezuordnung einen expliziten Host-Pfad, einen Containerpfad und Berechtigungen an.',
  'devices.error.path':
    'Gerätepfade müssen absolut sein, dürfen keine Steuerzeichen enthalten und müssen innerhalb des Limits dieses Editors liegen.',
  'devices.error.permissions':
    'Wählen Sie mindestens eine der Geräteberechtigungen r, w oder m. Jede Berechtigung darf nur einmal vorkommen.',
  'devices.error.duplicate': 'Jede Gerätezuordnung muss einen anderen Containerpfad haben.',
  'devices.error.contract': 'Der aktuelle Vertrag erlaubt keine Gerätezuordnungen beim Erstellen.',
  'devices.error.depth': 'Die Konfiguration hat zu viele Verschachtelungsebenen.',

  'selectorRows.target': 'Ziel-Labels',
  'selectorRows.guidance':
    'Alle Labels müssen mit dem Ziel übereinstimmen. Geben Sie mindestens ein Auswahl-Label ein.',
  'selectorRows.key': 'Label {index}: Schlüssel',
  'selectorRows.value': 'Label {index}: Wert',
  'selectorRows.removeRow': 'Label {index} entfernen',
  'selectorRows.remove': 'Entfernen',
  'selectorRows.add': 'Label hinzufügen',

  'resourceLimits.process.title': 'Prozesslimits',
  'resourceLimits.process.description':
    'Ohne Einträge gelten die Docker-Limits. Die Einheit hängt von der Ressource ab. -1 bedeutet unbegrenzt. Änderungen gelten für neue Container.',
  'resourceLimits.process.legacy':
    'Inkompatibles Altformat. Öffnen Sie die Konfiguration erneut im nativen Editor, um sie zu erhalten.',
  'resourceLimits.process.row': 'Limit {index}',
  'resourceLimits.process.resource': 'Ressource für Limit {index}',
  'resourceLimits.process.select': 'Auswählen…',
  'resourceLimits.process.unrecognized': 'Nicht erkannt: {name}',
  'resourceLimits.process.soft': 'Weiches Limit {index}',
  'resourceLimits.process.hard': 'Hartes Limit {index}',
  'resourceLimits.process.integerHint': 'Ganze Zahl von -1 bis 2147483647.',
  'resourceLimits.process.removeRow': 'Limit {index} entfernen',
  'resourceLimits.process.remove': 'Entfernen',
  'resourceLimits.process.add': 'Prozesslimit hinzufügen',
  'resourceLimits.memory.value': '{label}: Wert',
  'resourceLimits.memory.unit': '{label}: Einheit',
  'resourceLimits.memory.hint':
    'Bei 0 bleibt das Verhalten ohne explizites Limit bestehen. Die Reservierung darf ein positives Limit nicht überschreiten.',

  'schedulingEditor.title': 'Platzierungsaffinitäten',
  'schedulingEditor.description':
    'Kombinieren Sie Regeln zur Platzierung der Ressource. Präferenzen können unerfüllt bleiben. Zwingende Regeln können die Platzierung verhindern.',
  'schedulingEditor.global':
    'Globaler Dienst: Verwenden Sie ausschließlich Host-Labels mit zwingenden Regeln oder Ausschlussregeln. Die globale Skalierung bleibt erhalten.',
  'schedulingEditor.legacy':
    'Dieser Editor kann einige ältere Regeln nicht interpretieren. Bearbeiten Sie die nativen Labels oder deaktivieren Sie den strukturierten Editor. Es wurde nichts konvertiert.',
  'schedulingEditor.rule': 'Affinität {index}',
  'schedulingEditor.target': 'Affinitätsziel',
  'schedulingEditor.condition': 'Affinitätsbedingung',
  'schedulingEditor.kind.host_label': 'Host-Label',
  'schedulingEditor.kind.container_label': 'Container-Label',
  'schedulingEditor.kind.container': 'Containername',
  'schedulingEditor.mode.required': 'Muss übereinstimmen',
  'schedulingEditor.mode.exclude': 'Darf nicht übereinstimmen',
  'schedulingEditor.mode.prefer': 'Übereinstimmung bevorzugen',
  'schedulingEditor.mode.avoid': 'Übereinstimmung möglichst vermeiden',
  'schedulingEditor.key': 'Label-Schlüssel',
  'schedulingEditor.serviceHint':
    'Für einen Dienst: io.rancher.stack_service.name mit dem Wert stack/service.',
  'schedulingEditor.container': 'Name des Referenzcontainers',
  'schedulingEditor.value': 'Label-Wert',
  'schedulingEditor.remove': 'Affinität {index} entfernen',
  'schedulingEditor.removeRule': 'Regel entfernen',
  'schedulingEditor.add': 'Affinität hinzufügen',
  'schedulingEditor.native': 'Weitere Labels und native Regeln',

  'healthCheckEditor.title': 'Zustandsprüfung',
  'healthCheckEditor.type': 'Prüftyp',
  'healthCheckEditor.disabled': 'Deaktiviert',
  'healthCheckEditor.tcp': 'TCP-Verbindung',
  'healthCheckEditor.http': 'HTTP-Anfrage',
  'healthCheckEditor.port': 'Prüfport',
  'healthCheckEditor.portHint':
    'Interner Containerport. Auf dem Host wird kein Port veröffentlicht.',
  'healthCheckEditor.method': 'HTTP-Methode',
  'healthCheckEditor.version': 'HTTP-Version',
  'healthCheckEditor.path': 'HTTP-Prüfpfad',
  'healthCheckEditor.pathHint':
    'Beispiel: /health. Wählen Sie einen Endpunkt, der keine Schreibvorgänge auslöst.',
  'healthCheckEditor.host': 'HTTP-Host (optional)',
  'healthCheckEditor.advanced': 'Zeitsteuerung und Wiederherstellungsrichtlinie',
  'healthCheckEditor.strategy': 'Aktion bei Nichtverfügbarkeit',
  'healthCheckEditor.strategy.none': 'Nur melden',
  'healthCheckEditor.strategy.recreate': 'Container neu erstellen',
  'healthCheckEditor.strategy.recreateOnQuorum': 'Gemäß Quorum neu erstellen',
  'healthCheckEditor.quorum': 'Quorum für die Zustandsprüfung',
  'healthCheckEditor.notice':
    'Rancher kann Container gemäß der gewählten Richtlinie neu erstellen. Die Konfiguration der Prüfung bestätigt die Funktionsfähigkeit des Endpunkts nicht.',
  'healthCheckEditor.number.interval': 'Prüfintervall (ms)',
  'healthCheckEditor.number.responseTimeout': 'Zeitlimit für die Antwort (ms)',
  'healthCheckEditor.number.initializingTimeout': 'Zeitlimit für die Initialisierung (ms)',
  'healthCheckEditor.number.reinitializingTimeout':
    'Zeitlimit für die erneute Initialisierung (ms)',
  'healthCheckEditor.number.healthyThreshold':
    'Erfolgreiche Prüfungen bis zum Status „Funktionsfähig“',
  'healthCheckEditor.number.unhealthyThreshold':
    'Fehlgeschlagene Prüfungen bis zum Status „Nicht verfügbar“',

  'healthCheckValidation.request': 'Prüfen Sie die HTTP-Anfrage der Zustandsprüfung.',
  'healthCheckValidation.requestFormat':
    'Verwenden Sie einen HTTP-Pfad, der mit / beginnt und keine Leerzeichen, Anführungszeichen oder Zeilenumbrüche enthält, sowie einen gültigen Host.',
  'healthCheckValidation.contract': 'Der Vertrag für die Zustandsprüfung ist nicht verfügbar.',
  'healthCheckValidation.field':
    'Das Feld {name} der Zustandsprüfung ist nicht verfügbar. Öffnen Sie das Panel erneut.',
  'healthCheckValidation.integer': '{label} muss eine ganze Zahl zwischen {min} und {max} sein.',
  'healthCheckValidation.strategy': 'Die Strategie für die Zustandsprüfung ist nicht verfügbar.',
  'healthCheckValidation.quorum': 'Der Vertrag für das Quorum ist nicht verfügbar.',
  'healthCheckValidation.depth': 'Die Konfiguration der Zustandsprüfung ist zu tief verschachtelt.',

  'workloadControls.cpuShares.label': 'CPU-Gewichtung',
  'workloadControls.cpuShares.hint':
    'Relative Priorität bei konkurrierender CPU-Nutzung. Sie begrenzt die Nutzung nicht. Eine positive CPU-Reservierung hat Vorrang vor dieser Gewichtung. Der Cattle-Agent verwendet mindestens 2, auch wenn der Wert 0 ist.',
  'workloadControls.cpuPeriod.label': 'CPU-Periode (µs)',
  'workloadControls.cpuPeriod.hint':
    'Zeitfenster für das Limit: 1.000 bis 1.000.000 µs. Bei 0 gilt der Docker-Standardwert (in der Regel 100.000 µs).',
  'workloadControls.cpuQuota.label': 'CPU-Kontingent (µs)',
  'workloadControls.cpuQuota.hint':
    'Verfügbare Zeit pro Periode. Beispiel: 50.000 / 100.000 entspricht 0,5 CPU. Bei 0 oder -1 wird kein explizites Kontingent festgelegt.',
  'workloadControls.cpuSet.label': 'Zulässige CPUs',
  'workloadControls.cpuSet.hint':
    'CPU-Indizes wie 0,1 oder 0-3. Diese CPUs müssen auf dem Host verfügbar sein.',
  'workloadControls.blkioWeight.label': 'E/A-Gewichtung',
  'workloadControls.blkioWeight.hint':
    'Relative Gewichtung von 10 bis 1.000. Bei 0 gilt der Standardwert. Die Gewichtung setzt Kernel-Unterstützung voraus und legt keine Übertragungsrate in MB/s fest.',
  'workloadControls.milliCpuReservation.label': 'CPU-Reservierung (Millicores)',
  'workloadControls.milliCpuReservation.hint':
    'Reservierung für die Platzierung: 1.000 Millicores = 1 CPU. Ein positiver Wert ersetzt auch die CPU-Gewichtung (250 Millicores → Gewichtung 256). Die Reservierung legt kein Laufzeitkontingent fest.',
  'workloadControls.capabilityHint':
    'Wählen Sie nur die benötigten Capabilities aus. ALL steht für alle Optionen. Docker wendet die Konfiguration an.',
  'workloadControls.unknownCapability':
    'Der Wert {value} ist im aktuellen Vertrag nicht vorgesehen. Prüfen Sie ihn vor dem Erstellen.',
  'workloadControls.capabilityLabel': '{label}: Capability {index}',
  'workloadControls.select': 'Auswählen…',
  'workloadControls.removeLabel': '{label} {index} entfernen',
  'workloadControls.removeCapability': 'Capability entfernen',
  'workloadControls.addLabel': '{label} hinzufügen',
  'workloadControls.cpuInteger':
    'Geben Sie eine ganze Zahl ohne Nachkommastellen oder Exponentialschreibweise ein.',
  'workloadControls.cpuSafeInteger':
    'Geben Sie eine ganze Zahl innerhalb des sicher darstellbaren Bereichs ein.',
  'workloadControls.cpuIndices':
    'Verwenden Sie durch Kommas getrennte CPU-Indizes oder Bereiche wie 0-3.',
  'workloadControls.cpuRanges':
    'Verwenden Sie aufsteigende Bereiche ganzzahliger CPU-Indizes im sicher darstellbaren Bereich.',
  'workloadControls.cpuReview': 'Prüfen Sie {label}. {hint}',

  'requestError.scopeChanged':
    'Der Kontext hat sich geändert. Öffnen Sie das Fenster erneut, bevor Sie fortfahren.',
  'requestError.resourceOutOfScope': 'Die Ressource ist in dieser Umgebung nicht verfügbar.',
  'requestError.unsafeUrl': 'Der Server hat eine unzulässige API-Adresse zurückgegeben.',
  'requestError.paginationCycle':
    'Die API hat eine Schleife in der Seitennavigation zurückgegeben.',
  'requestError.paginationLimit': 'Die Sammlung ist zu groß. Schränken Sie die Filter ein.',
  'requestError.invalidCollection': 'Die API hat eine ungültige Sammlung zurückgegeben.',

  'resourceCreator.kind.stack': 'Stack',
  'resourceCreator.kind.service': 'Dienst',
  'resourceCreator.kind.loadBalancerService': 'Load Balancer',
  'resourceCreator.kind.dnsService': 'Dienstalias',
  'resourceCreator.kind.externalService': 'Externer Dienst',
  'resourceCreator.kind.container': 'Eigenständiger Container',
  'resourceCreator.kind.resource': 'Ressource',
  'resourceCreator.title': 'Erstellen: {kind}',
  'resourceCreator.stackContext': 'Umgebung: {environment} · Stack: {stack}',
  'resourceCreator.create': 'Erstellen',
  'resourceCreator.created': '{kind} {name} wurde erstellt. Verfolgen Sie den Status im Vorgang.',
  'resourceCreator.unavailable': 'In diesem Kontext können keine Ressourcen erstellt werden.',
  'resourceCreator.schemaUnavailable': 'Das Schema zum Erstellen ist nicht verfügbar.',
  'resourceCreator.permissionChanged':
    'Sie haben keine Berechtigung mehr, Ressourcen zu erstellen.',
  'resourceCreator.stackUnavailable': 'Zu diesem Stack können keine Dienste hinzugefügt werden.',
  'resourceCreator.schemaChanged': 'Das Schema zum Erstellen ist nicht mehr verfügbar.',
  'resourceCreator.validation.unavailable': 'Diese Ressource kann nicht mehr erstellt werden.',
  'resourceCreator.validation.depth': 'Die Konfiguration ist zu tief verschachtelt.',
  'resourceCreator.validation.fieldUnavailable':
    'Das Feld {name} steht beim Erstellen nicht mehr zur Verfügung. Öffnen Sie das Panel erneut.',
  'resourceCreator.validation.schemaUnavailable':
    'Das Schema für {name} ist nicht mehr verfügbar. Öffnen Sie das Panel erneut.',
  'resourceCreator.creationDenied':
    'Ihr Profil oder der Server erlaubt es nicht, diese Ressource in der ausgewählten Umgebung zu erstellen.',
  'resourceCreator.discardTitle': 'Entwurf verwerfen?',
  'resourceCreator.discardDescription':
    'Die Ressource wurde noch nicht erstellt. Ihre Eingaben werden verworfen.',
  'resourceCreator.contextTitle': 'Kontext wechseln?',
  'resourceCreator.pending': 'Warten Sie auf die Antwort von Rancher.',
  'resourceCreator.unsaved': 'Es gibt einen ungespeicherten Entwurf.',

  'workloadStreams.logs': 'Logs der Ressource',
  'workloadStreams.terminal': 'Terminal der Ressource',
  'workloadStreams.emptyTitle': 'Keine Container verfügbar',
  'workloadStreams.emptyDescription':
    'Rancher hat diesen Vorgang für die Container dieser Ressource nicht freigegeben.',
  'workloadStreams.stack': 'Stack:',
  'workloadStreams.service': 'Dienst:',
  'workloadStreams.container': 'Container',
  'workloadStreams.selectionHint':
    'Es wird nur der ausgewählte Container angezeigt. Beim Wechsel des Containers wird die bisherige Verbindung geschlossen.',

  'resourceStream.scope': 'Die Ressource gehört nicht zur ausgewählten Umgebung.',
  'resourceStream.invalidFrame': 'Eine ungültige Verbindungsnachricht wurde empfangen.',
  'resourceStream.failed':
    'Die Verbindung ist fehlgeschlagen. Schließen Sie dieses Fenster und versuchen Sie es erneut.',
  'resourceStream.revoked':
    'Die Verbindung wurde geschlossen, weil Ihre Sitzung nicht mehr verfügbar ist oder Ihnen die Berechtigung fehlt.',
  'resourceStream.unavailable':
    'Die Ressource ist nicht mehr verfügbar oder Ihr Zugriff ist abgelaufen.',
  'resourceStream.startFailed':
    'Die Verbindung konnte nicht hergestellt werden. Prüfen Sie den Zustand der Ressource und Ihre Berechtigungen.',
  'resourceStream.logs': 'Logs',
  'resourceStream.console': 'Konsole',
  'resourceStream.connected': 'Verbunden',
  'resourceStream.closed': 'Verbindung geschlossen',
  'resourceStream.connecting': 'Verbindung wird hergestellt…',
  'resourceStream.waiting': 'Warten auf Verbindung',
  'resourceStream.description': 'Umgebung: {name} · {status}',
  'resourceStream.close': 'Verbindung schließen',
  'resourceStream.warning':
    'Die Konsole führt Befehle im ausgewählten Container mit den von Rancher erteilten Berechtigungen aus.',
  'resourceStream.connect': 'Mit Container verbinden',
  'resourceStream.terminal': 'Container-Terminal',
  'resourceStream.filter': 'Logs filtern',
  'resourceStream.filterPlaceholder': 'Empfangene Zeilen filtern…',
  'resourceStream.resume': 'Scrollen fortsetzen',
  'resourceStream.pause': 'Scrollen anhalten',
  'resourceStream.download': 'Herunterladen',
  'resourceStream.buffer':
    'Der Puffer ist auf die letzten 2.000 Zeilen und 512 KB begrenzt. Suche und Download verwenden nur die in diesem Fenster empfangenen Inhalte.',
  'resourceStream.logLabel': 'Container-Logs',

  'resourcePanel.upgradeStack': 'Stack aktualisieren',
  'resourcePanel.saved':
    'Rancher hat den Vorgang entgegengenommen. Verfolgen Sie seinen Status auf dieser Seite.',
  'resourcePanel.save': 'Änderungen speichern',
  'resourcePanel.applyScale': 'Skalierung anwenden',
  'resourcePanel.confirm': 'Vorgang bestätigen',
  'resourcePanel.discardTitle': 'Entwurf verwerfen?',
  'resourcePanel.discardDescription': 'Die Änderungen wurden noch nicht gespeichert.',
  'resourcePanel.pendingTitle': 'Vorgang läuft',
  'resourcePanel.leaveTitle': 'Ohne Speichern verlassen?',
  'resourcePanel.pendingDescription':
    'Warten Sie auf die Antwort von Rancher, bevor Sie den Kontext wechseln.',
  'resourcePanel.leaveDescription': 'In diesem Bereich gibt es ungespeicherte Änderungen.',
  'resourcePanel.close': 'Schließen',
  'resourcePanel.directLink': 'Direktlink',
  'resourcePanel.balancer': 'Load Balancer konfigurieren',
  'resourcePanel.scale': 'Dienst skalieren',
  'resourcePanel.metrics': 'Metriken',
  'resourcePanel.edit': 'Bearbeiten',
  'resourcePanel.back': 'Zurück zur Ressource',
  'resourcePanel.readOnly':
    'Mit Ihrem Profil können Sie diese Ressource ansehen. Änderungen sind nicht möglich.',
  'resourcePanel.inputUnavailable':
    'Der Server hat die für diesen Vorgang erforderlichen Felder nicht bereitgestellt.',
  'resourcePanel.scaleUnavailable':
    'Die Skalierung ist in diesem Status oder Modul nicht verfügbar.',
  'resourcePanel.composeTitle': 'Compose exportiert',
  'resourcePanel.composeDescription': 'Das Ergebnis bleibt bis zum Schließen in diesem Bereich.',
  'resourcePanel.download': 'Herunterladen',
  'resourcePanel.closeResult': 'Ergebnis schließen',
  'resourcePanel.operationUnavailable': 'Dieser Vorgang ist für Ihr Konto nicht verfügbar.',
  'resourcePanel.editSchemaUnavailable': 'Das Schema für die Bearbeitung ist nicht verfügbar.',
  'resourcePanel.editPermissionUnavailable': 'Sie haben keine Bearbeitungsberechtigung mehr.',
  'resourcePanel.scalingDisabled': 'Das Skalierungsmodul ist deaktiviert.',
  'resourcePanel.actionUnavailable':
    'Der Vorgang ist in diesem Status nicht mehr verfügbar. Aktualisieren Sie die Ressource.',
  'resourcePanel.bindingsDisabled': 'Die Bearbeitung von Ports und Volumes ist deaktiviert.',
  'resourcePanel.healthCheckDisabled': 'Die Bearbeitung der Zustandsprüfung ist deaktiviert.',
  'resourcePanel.sidecarsDisabled': 'Die Bearbeitung von Sidecars ist deaktiviert.',
  'resourcePanel.schedulingDisabled': 'Die Bearbeitung von Affinitäten ist deaktiviert.',
  'resourcePanel.memoryDisabled':
    'Die Aktualisierung der Arbeitsspeichereinstellungen ist deaktiviert.',
  'resourcePanel.cpuDisabled': 'Die Aktualisierung der CPU- und E/A-Einstellungen ist deaktiviert.',
  'resourcePanel.securityDisabled':
    'Die Aktualisierung der Sicherheitseinstellungen ist deaktiviert.',
  'resourcePanel.ulimitsDisabled': 'Die Aktualisierung der Prozesslimits ist deaktiviert.',
  'resourcePanel.editPrefix': 'Bearbeiten · ',
  'resourcePanel.scalePrefix': 'Dienst skalieren · ',
  'resourcePanel.environment': 'Umgebung: {name} · {id}',
  'resourcePanel.health': 'Gesundheitsstatus: {state}',
  'resourcePanel.actionNotice':
    'Der Vorgang „{action}“ wird nur auf {name} in der Umgebung {environment} angewendet.',
  'resourcePanel.downloadLabel': '{filename} herunterladen',

  'details.field.id': 'ID',
  'details.field.name': 'Name',
  'details.field.description': 'Beschreibung',
  'details.field.type': 'Ressourcentyp',
  'details.field.state': 'Status',
  'details.field.healthState': 'Gesundheitsstatus',
  'details.field.imageUuid': 'Image',
  'details.field.scale': 'Replikatanzahl',
  'details.field.hostname': 'Hostname',
  'details.field.primaryIpAddress': 'IP-Adresse',
  'details.field.hostId': 'Host',
  'details.field.stackId': 'Stack',
  'details.field.accountId': 'Konto',
  'details.field.projectTemplateId': 'Umgebungsvorlage',
  'details.field.orchestration': 'Orchestrator',
  'details.field.created': 'Erstellt am',
  'details.field.serverAddress': 'Registry-Adresse',
  'details.field.CN': 'Allgemeiner Name',
  'details.field.expiresAt': 'Gültig bis',
  'details.field.issuedAt': 'Ausgestellt am',
  'details.field.certFingerprint': 'Fingerabdruck',
  'details.field.driver': 'Treiber',
  'details.field.sizeMb': 'Angeforderte Kapazität (MiB)',
  'details.field.transitioningMessage': 'Meldung zum Vorgang',
  'details.summary': 'Übersicht',
  'details.configuration': 'Konfiguration',
  'details.label': 'Ressourcendetails',
  'details.explanation':
    'Von Rancher gelieferte Konfiguration. Vertrauliche Felder sind in dieser Ansicht geschützt.',
  'details.copy': 'Kopieren',
  'details.copied': 'Konfiguration kopiert.',
  'details.copyFailed':
    'Kopieren fehlgeschlagen. Wählen Sie den Text aus, um ihn manuell zu kopieren.',
  'details.sanitized': 'Bereinigte Konfiguration',
  'details.certificate.unknown': 'Ablaufdatum nicht verfügbar',
  'details.certificate.expired': 'Abgelaufen',
  'details.certificate.valid': 'Gültig',
  'details.certificate.expiring': {
    one: 'Läuft in {count} Tag ab',
    other: 'Läuft in {count} Tagen ab',
  },

  'resourceMetrics.disabled': 'Metriken deaktiviert',
  'resourceMetrics.enable': 'Aktivieren Sie das Metrikmodul in der Konsolenkonfiguration.',
  'resourceMetrics.paused': 'Angehalten',
  'resourceMetrics.live': 'Live',
  'resourceMetrics.stale': 'Keine neuen Messwerte',
  'resourceMetrics.closed': 'Verbindung geschlossen',
  'resourceMetrics.connecting': 'Verbindung wird hergestellt…',
  'resourceMetrics.resume': 'Fortsetzen',
  'resourceMetrics.pause': 'Anhalten',
  'resourceMetrics.reconnect': 'Metrikverbindung erneut herstellen',
  'resourceMetrics.container': 'Container des Dienstes',
  'resourceMetrics.awaiting': 'Warten auf Messwerte',
  'resourceMetrics.cpu': 'CPU',
  'resourceMetrics.cpuUsage': 'CPU-Auslastung',
  'resourceMetrics.memory': 'Arbeitsspeicher',
  'resourceMetrics.memoryUsed': 'Belegter Arbeitsspeicher',
  'resourceMetrics.noMemoryLimit': 'Der Agent hat kein Arbeitsspeicherlimit gemeldet.',
  'resourceMetrics.network': 'Netzwerk',
  'resourceMetrics.received': 'Empfangen',
  'resourceMetrics.sent': 'Gesendet',
  'resourceMetrics.networkNote':
    'Die Raten werden anhand aufeinanderfolgender Messwerte derselben Schnittstellen berechnet.',
  'resourceMetrics.disk': 'Datenträger',
  'resourceMetrics.read': 'Lesen',
  'resourceMetrics.write': 'Schreiben',
  'resourceMetrics.diskNote': 'Fehlende Zähler werden als nicht verfügbar angezeigt.',
  'resourceMetrics.unavailableCounter': 'Zähler nicht verfügbar',
  'resourceMetrics.waitingAgent': 'Warten auf Daten vom Agenten…',
  'resourceMetrics.close': 'Schließen',
  'resourceMetrics.csv': 'CSV',
  'resourceMetrics.staleWarning':
    'Der Agent hat in letzter Zeit keine neuen Messwerte gesendet. Die letzten Werte bleiben mit ihren Zeitstempeln sichtbar.',
  'resourceMetrics.history':
    'Der Verlauf bleibt erhalten, solange dieses Fenster geöffnet ist. Die Berechtigungen werden alle 15 Sekunden erneut geprüft.',
  'resourceMetrics.wrongEnvironment': 'Die Ressource gehört nicht zur ausgewählten Umgebung.',
  'resourceMetrics.resourceDenied':
    'Die Metrikerfassung wurde beendet, weil die Ressource nicht mehr verfügbar ist oder die Berechtigung fehlt.',
  'resourceMetrics.serviceUnavailable':
    'Der Server stellt für diesen Dienst keine Metriken bereit.',
  'resourceMetrics.serviceLinkMismatch': 'Die Metrikadresse gehört nicht zum ausgewählten Dienst.',
  'resourceMetrics.serviceEnvironmentMismatch':
    'Der Dienst gehört nicht zur ausgewählten Umgebung.',
  'resourceMetrics.serviceContainerMismatch':
    'Die Containerliste stimmt nicht mit dem ausgewählten Dienst überein.',
  'resourceMetrics.serviceContainerConflict':
    'Die Containerliste enthält widersprüchliche Identitäten.',
  'resourceMetrics.incomplete': 'Die Containerliste des Dienstes ist unvollständig.',
  'resourceMetrics.targetLimit': 'Dieses Fenster unterstützt bis zu 64 Container pro Dienst.',
  'resourceMetrics.noTargets':
    'In diesem Dienst gibt es keine laufenden Container, für die Metriken erfasst werden können.',
  'resourceMetrics.negotiation': 'Die Metrikverbindung konnte nicht ausgehandelt werden.',
  'resourceMetrics.invalidSample': 'Der Server hat einen ungültigen Messwert gesendet.',
  'resourceMetrics.connectionFailed':
    'Die Metrikverbindung ist fehlgeschlagen. Versuchen Sie, die Verbindung erneut herzustellen.',
  'resourceMetrics.sessionDenied':
    'Die Metrikerfassung wurde beendet, weil Ihre Sitzung nicht mehr verfügbar ist oder Ihnen die Berechtigung fehlt.',
  'resourceMetrics.membershipChanged':
    'Die Container des Dienstes haben sich geändert. Stellen Sie die Verbindung erneut her, um die Metriken zu aktualisieren.',
  'resourceMetrics.failed':
    'Die Metriken für diese Ressource konnten nicht abgerufen werden. Prüfen Sie den Zustand der Ressource, die Verbindung zum Agenten und Ihre Berechtigungen.',
  'resourceMetrics.title': 'Metriken · {name}',
  'resourceMetrics.description': 'Umgebung: {name} · Live-Messwerte von Rancher',
  'resourceMetrics.containerHint':
    'Für {sampled} von {total} Containern liegen in dieser Verbindung Messwerte vor. Der CSV-Export enthält die Messwerte des ausgewählten Containers.',
  'resourceMetrics.lastSample': 'Letzter Messwert um {time}',
  'resourceMetrics.memoryLimit': 'Gemeldetes Limit: {limit} MiB.',
  'resourceMetrics.chartLabel': '{title}: Messwerte im Zeitverlauf',
  'resourceMetrics.cpuNote': '100 % entsprechen einem Kern.',
  'resourceMetrics.cpuNoteReported': '100 % entsprechen einem Kern · {cores} Kerne gemeldet.',
  'resourceMetrics.caption': 'Letzte 5 Minuten dieser Verbindung · bis zu 300 Messwerte · {status}',

  'bulkOperation.title': 'Sammelaktion: {action}',
  'bulkOperation.resources': { one: '{count} Ressource', other: '{count} Ressourcen' },
  'bulkOperation.description': 'Umgebung: {name} · {resources}',
  'bulkOperation.confirm': {
    one: '{count} Vorgang bestätigen',
    other: '{count} Vorgänge bestätigen',
  },
  'bulkOperation.closeResults': 'Ergebnisse schließen',
  'bulkOperation.warning':
    'Der Vorgang wird auf jede aufgeführte Ressource angewendet. Ein Fehler macht Vorgänge, die Rancher bereits entgegengenommen hat, nicht rückgängig. Prüfen Sie die betroffenen Ressourcen vor der Bestätigung.',
  'bulkOperation.restartHint':
    'Dienste werden in Gruppen von jeweils 1 Container neu gestartet. Zwischen den Gruppen liegen 2 Sekunden. Die Übermittlung wird für jede Ressource einzeln verfolgt. Prüfen Sie den endgültigen Status in der Vorgangsansicht.',
  'bulkOperation.removeWarning':
    'Beim Entfernen kann Rancher im Rahmen seines Lebenszyklus Container stoppen und abhängige Ressourcen entfernen. Der Vorgang wird nicht automatisch rückgängig gemacht.',
  'bulkOperation.confirmEnvironment': 'Namen der Umgebung bestätigen',
  'bulkOperation.sending': 'Vorgänge werden übermittelt',
  'bulkOperation.finished': 'Übermittlung beendet',
  'bulkOperation.progress':
    '{status} · {received} von {total} Antworten. Verfolgen Sie den endgültigen Status in der Vorgangsansicht.',
  'bulkOperation.resource': 'Ressource',
  'bulkOperation.result': 'Ergebnis',
  'bulkOperation.status.accepted': 'Entgegengenommen',
  'bulkOperation.status.failed': 'Fehlgeschlagen',
  'bulkOperation.status.unknown': 'Status prüfen',
  'bulkOperation.queued': 'Wartet auf Übermittlung',
  'bulkOperation.pending': 'Wartet auf Bestätigung',
  'bulkOperation.runningTitle': 'Vorgang läuft',
  'bulkOperation.runningDescription':
    'Warten Sie, bis alle Vorgänge übermittelt wurden, bevor Sie die Ansicht oder die Umgebung wechseln.',
  'bulkOperation.stay': 'In dieser Ansicht bleiben',
  'bulkOperation.message.startFailed': 'Die Sammelaktion konnte nicht gestartet werden.',
  'bulkOperation.message.invalidSelection':
    'Wählen Sie zwischen 1 und 100 Ressourcen für einen gültigen Vorgang aus.',
  'bulkOperation.message.duplicateResources': 'Die Sammelaktion enthält doppelte Ressourcen.',
  'bulkOperation.message.mixedRemoval':
    'Beim gemeinsamen Entfernen müssen alle Ressourcen denselben Typ haben.',
  'bulkOperation.message.wrongEnvironment':
    'Die Ressource gehört nicht zur Umgebung dieser Sammelaktion.',
  'bulkOperation.message.actionUnavailable':
    'Die Aktion ist nicht mehr verfügbar. Prüfen Sie den Status und Ihre Berechtigungen.',
  'bulkOperation.message.accepted':
    'Von Rancher entgegengenommen. Verfolgen Sie den Status der Ressource.',
  'bulkOperation.message.unknown':
    'Es wurde keine Antwort bestätigt. Prüfen Sie den Status, bevor Sie es erneut versuchen.',
  'bulkOperation.message.timeout': 'Die Ressource konnte nicht rechtzeitig abgefragt werden.',
  'bulkOperation.message.failed': 'Der Vorgang konnte nicht ausgeführt werden.',

  'operations.selectEnvironment': 'Umgebung auswählen',
  'operations.selectEnvironmentHint':
    'Wählen Sie in der oberen Leiste eine autorisierte Umgebung aus, um deren Ressourcen zu verwalten.',
  'operations.eyebrow': 'VORGÄNGE IN DER UMGEBUNG',
  'operations.description':
    'Zeigen Sie Stacks, Dienste und Container gemeinsam an. Öffnen Sie Aktionen und Details direkt in der Umgebung.',
  'operations.create': 'Erstellen',
  'operations.refresh': 'Aktualisieren',
  'operations.bulkActions': 'Sammelaktionen',
  'operations.selection': {
    one: '{count} Ressource ausgewählt · maximal 100',
    other: '{count} Ressourcen ausgewählt · maximal 100',
  },
  'operations.selectedAction': 'Ausgewählte Aktion: {action}',
  'operations.noCommonAction':
    'Für die ausgewählten Ressourcen ist keine gemeinsame Aktion verfügbar.',
  'operations.clearSelection': 'Auswahl aufheben',
  'operations.stackName': 'Stack {name}',
  'operations.collapseStack': 'Stack {name} zuklappen',
  'operations.expandStack': 'Stack {name} aufklappen',
  'operations.serviceCount': 'Dienste: {count}',
  'operations.system': ' · Infrastruktur',
  'operations.emptyStack':
    'In diesem Stack entsprechen keine Dienste oder Container den aktuellen Filtern.',
  'operations.orphanServices': 'Dienste ohne verfügbaren Stack',
  'operations.orphanContainers': 'Eigenständige Container und sonstige Zuordnungen',
  'operations.environmentServices': 'Dienste der Umgebung',
  'operations.environmentContainers': 'Container der Umgebung',
  'operations.standaloneContainer': 'Eigenständiger Container',
  'operations.collapseContainers': 'Container für {name} zuklappen',
  'operations.expandContainers': 'Container für {name} aufklappen',
  'operations.noStack': 'Kein Stack',
  'operations.containerCount': 'Container: {count} · Replikatanzahl: {scale}',
  'operations.emptyService': 'In diesem Dienst entsprechen keine Container den aktuellen Filtern.',
  'operations.selectResource': '{name} auswählen',
  'operations.resourceAction': '{action}: {name}',
  'operations.resourceLogs': 'Logs für {name} anzeigen',
  'operations.resourceTerminal': 'Terminal für {name} öffnen',
  'operations.addService': 'Dienst zu diesem Stack hinzufügen',
  'operations.addServiceToStack': 'Dienst zu {name} hinzufügen',
  'operations.manage': 'Verwalten',
  'operations.manageResource': '{name} verwalten',
  'operations.upgradeStack': 'Stack aktualisieren',
  'operations.restartServices': 'Dienste neu starten ({count})',
  'operations.restartLimit': 'Wählen Sie für diesen Vorgang bis zu 100 Dienste aus.',
  'operations.action.start': 'Starten',
  'operations.action.activate': 'Aktivieren',
  'operations.action.stop': 'Stoppen',
  'operations.action.deactivate': 'Deaktivieren',
  'operations.action.restart': 'Neu starten',
  'operations.action.activateservices': 'Dienste starten',
  'operations.action.deactivateservices': 'Dienste stoppen',
  'operations.action.upgrade': 'Dienst aktualisieren',
  'operations.action.rollback': 'Aktualisierung zurücksetzen',
  'operations.action.finishupgrade': 'Aktualisierung abschließen',
  'operations.action.cancelupgrade': 'Aktualisierung abbrechen',
  'operations.action.cancelrollback': 'Zurücksetzen abbrechen',
  'operations.action.exportconfig': 'Compose exportieren',
  'operations.action.remove': 'Entfernen',
  'operations.action.purge': 'Endgültig löschen',
  'operations.action.setservicelinks': 'Dienstverknüpfungen verwalten',

  'operations.stackMetric': 'Stacks',
  'operations.serviceMetric': 'Dienste',
  'operations.containerMetric': 'Container',
  'operations.totals': 'Gesamtzahlen der Umgebung · alle 15 s aktualisiert',
  'operations.visibleStacks': 'Sichtbare Stacks · {count}',
  'operations.visibleServices': 'Sichtbare Dienste · {count}',
  'operations.visibleContainers': 'Passende Container · {count}',
  'operations.hiddenSystem': ' · Ausgeblendete Infrastruktur-Stacks: {count}',
  'operations.resourceActions': 'Aktionen für {name}',
  'operations.details': 'Details anzeigen',
  'operations.logs': 'Logs anzeigen',
  'operations.terminal': 'Terminal öffnen',
  'operations.metrics': 'Metriken',
  'operations.edit': 'Konfiguration bearbeiten',
  'operations.scale': 'Dienst skalieren',
  'operations.balancer': 'Load Balancer konfigurieren',
  'operations.createService': 'Dienst hinzufügen',
  'operations.logsUnavailable': 'Für diese Ressource sind keine Container mit Logs verfügbar.',
  'operations.terminalUnavailable':
    'Für diese Ressource sind keine Container mit Terminal verfügbar.',
  'operations.stacks': 'Stacks',
  'operations.services': 'Dienste',
  'operations.containers': 'Container',
  'operations.view': 'Vorgangsansicht',
  'operations.expandAll': 'Alle aufklappen',
  'operations.collapseAll': 'Alle zuklappen',
  'operations.topology': 'Topologie',

  'topology.title': 'Diensttopologie',
  'topology.close': 'Schließen',
  'topology.unavailableTitle': 'Topologie nicht verfügbar',
  'topology.unavailableDescription':
    'Der Server stellt die Liste der Dienstverknüpfungen in diesem Kontext nicht bereit.',
  'topology.emptyTitle': 'Keine Dienste',
  'topology.emptyDescription': 'In dieser Umgebung sind keine Dienste verfügbar.',
  'topology.stack': 'Stack',
  'topology.allStacks': 'Alle Stacks',
  'topology.noStack': 'Kein Stack',
  'topology.summary': '{services} Dienste · {links} native Verknüpfungen',
  'topology.unresolved':
    '{count} Verknüpfungen verweisen auf Dienste außerhalb dieses Inventars. Die Topologie ist unvollständig.',
  'topology.limit':
    'Die Topologie überschreitet die Grenze von 500 Diensten oder 2.000 Verknüpfungen. Verwenden Sie die Listenansicht.',
  'topology.wrongEnvironment': 'Die Topologie enthält Ressourcen aus einer anderen Umgebung.',
  'topology.duplicateServices': 'Das Inventar enthält doppelte Dienste.',
  'topology.region': 'Diensttopologie der Umgebung',
  'topology.controls': 'Steuerelemente der Topologie',
  'topology.zoomIn': 'Topologie vergrößern',
  'topology.zoomOut': 'Topologie verkleinern',
  'topology.fitView': 'Topologie an Ansicht anpassen',
  'topology.nodeKeyboard':
    'Drücken Sie die Eingabe- oder Leertaste, um einen Knoten auszuwählen. Verschieben Sie ihn mit den Pfeiltasten oder heben Sie die Auswahl mit Esc auf.',
  'topology.nodeMoved': 'Ausgewählter Knoten verschoben. Position: x {x}, y {y}.',
  'topology.link': 'Verknüpfung von {source} zu {target}',
  'operations.search': 'Vorgänge durchsuchen',
  'operations.searchPlaceholder': 'Stack, Dienst, Container, Image oder ID…',
  'operations.state': 'Status',
  'operations.allStates': 'Alle Status',
  'operations.includeSystem': 'Infrastruktur einbeziehen',
  'operations.empty': 'Keine Ressourcen entsprechen diesen Filtern',
  'operations.emptyHint':
    'Prüfen Sie die Suche, den Status oder die Infrastruktur-Option. Angezeigt werden nur Ressourcen der ausgewählten Umgebung.',

  'groups.role.readonly': 'Schreibgeschützt',
  'groups.role.restricted': 'Eingeschränkt',
  'groups.role.member': 'Mitglied',
  'groups.role.owner': 'Eigentümer',

  'resourceState.active': 'Aktiv',
  'resourceState.inactive': 'Inaktiv',
  'resourceState.running': 'Läuft',
  'resourceState.stopped': 'Gestoppt',
  'resourceState.healthy': 'Funktionsfähig',
  'resourceState.unhealthy': 'Fehlerhaft',
  'resourceState.degraded': 'Beeinträchtigt',
  'resourceState.starting': 'Wird gestartet',
  'resourceState.stopping': 'Wird gestoppt',
  'resourceState.restarting': 'Wird neu gestartet',
  'resourceState.activating': 'Wird aktiviert',
  'resourceState.deactivating': 'Wird deaktiviert',
  'resourceState.upgrading': 'Upgrade läuft',
  'resourceState.upgraded': 'Upgrade abgeschlossen',
  'resourceState.updating-active': 'Wird aktualisiert',
  'resourceState.rolling-back': 'Rollback läuft',
  'resourceState.disconnected': 'Getrennt',
  'resourceState.reconnecting': 'Verbindung wird wiederhergestellt',
  'resourceState.error': 'Fehler',
  'resourceState.removed': 'Entfernt',

  'ui.loading': 'Daten werden geladen…',
  'ui.loadFailed': 'Die Daten konnten nicht geladen werden.',
  'ui.retry': 'Erneut versuchen',
  'ui.closeDialog': 'Dialog schließen',
  'ui.cancel': 'Abbrechen',
  'ui.confirm': 'Bestätigen',
  'ui.table.label': 'Datentabelle',
  'ui.table.emptyTitle': 'Keine Ergebnisse',
  'ui.table.emptyDescription': 'Keine Einträge entsprechen den ausgewählten Filtern.',
  'ui.table.searchPlaceholder': 'Diese Liste durchsuchen…',
  'ui.table.searchLabel': 'Einträge suchen',
  'ui.table.records': { one: '{count} Eintrag', other: '{count} Einträge' },
  'ui.table.zeroRecords': '{count} Einträge',
  'ui.table.select': 'Auswählen',
  'ui.table.selectRow': '{name} auswählen',
  'ui.table.range': '{start}–{end} von {total}',
  'ui.table.previous': 'Vorherige Seite',
  'ui.table.next': 'Nächste Seite',
  'ui.table.page': 'Seite {page} von {total}',
  'ui.dismissNotification': 'Benachrichtigung schließen',

  'auth.entryFailed':
    'Die Authentifizierung konnte nicht abgeschlossen werden. Melden Sie sich erneut an.',
  'auth.providerUnavailable':
    'Der Identitätsanbieter ist nicht erreichbar. Versuchen Sie es erneut.',
  'auth.ticketRejected':
    'Die Anmeldung ist abgelaufen oder wurde abgelehnt. Melden Sie sich erneut an.',
  'auth.completingLogin': 'Anmeldung wird abgeschlossen…',
  'auth.welcome': 'WILLKOMMEN IN DER KONSOLE',
  'auth.loginTitle': 'Auf Ihre Umgebung zugreifen',
  'auth.loginDescription':
    'Melden Sie sich mit Ihrem Konto an, um die Ressourcen zu verwalten, auf die Sie Zugriff haben.',
  'auth.providerLogoutWarning':
    'Sie haben sich von dieser Konsole abgemeldet. Die Abmeldung beim Identitätsanbieter konnte nicht bestätigt werden.',
  'auth.serverLogoutWarning':
    'Die Sitzung wurde aus diesem Browser entfernt. Ob sie auf dem Server beendet wurde, konnte nicht bestätigt werden.',
  'auth.methodsUnavailable': 'Die Anmeldemethoden konnten nicht überprüft werden.',
  'auth.retry': 'Erneut versuchen',
  'auth.checkingAccess': 'Zugriff wird geprüft…',
  'auth.keycloakLogin': 'Mit Keycloak anmelden',
  'auth.localAlternative': 'oder Ihr lokales Konto verwenden',
  'auth.username': 'Benutzername',
  'auth.password': 'Passwort',
  'auth.localLogin': 'Mit einem lokalen Konto anmelden',
  'auth.localRejected':
    'Die Anmeldung konnte nicht abgeschlossen werden. Prüfen Sie Ihre Zugangsdaten und versuchen Sie es erneut.',
  'auth.pendingStill': 'Ihre Zugriffsfreigabe steht noch aus.',
  'auth.accessCheckFailed': 'Der Zugriff konnte nicht überprüft werden. Versuchen Sie es erneut.',
  'auth.accessTitle': 'Ihr Zugriff',
  'auth.accessDescription':
    'Sie sind angemeldet. Es muss noch festgelegt werden, auf welche Umgebungen Sie zugreifen dürfen.',
  'auth.pendingEyebrow': 'ZUGRIFF NOCH NICHT FREIGEGEBEN',
  'auth.pendingTitle': 'Ihr Arbeitsbereich ist fast bereit',
  'auth.pendingDescription':
    'Eine Person mit Administratorrechten muss Ihr Konto einer Gruppe hinzufügen, die auf die Umgebungen zugreifen darf. Es wird keine Umgebung automatisch erstellt.',
  'auth.contactAdmin': 'Wenden Sie sich an Ihre Administration',
  'auth.accountHint': 'Geben Sie Ihr Konto an: {account}.',
  'auth.groupAccess': 'Zugriff über Ihre Gruppe erhalten',
  'auth.groupAccessDescription': 'Berechtigungen werden in Rancher festgelegt und verwaltet.',
  'auth.returnConsole': 'Zurück zu Ihrer Konsole',
  'auth.returnConsoleDescription':
    'Prüfen Sie den Zugriff nach der Freigabe erneut, um Ihre Umgebungen zu laden.',
  'auth.checkAccess': 'Zugriff prüfen',
  'auth.signOut': 'Abmelden',
  'auth.moduleDisabled': 'Modul deaktiviert',
  'auth.accessRestricted': 'Zugriff eingeschränkt',
  'auth.notFound': 'Seite nicht gefunden',
  'auth.moduleDisabledDescription':
    'Dieses Modul ist in der Konfiguration der Konsole deaktiviert.',
  'auth.accessRestrictedDescription': 'Ihr Konto hat keine Berechtigung für diesen Bereich.',
  'auth.notFoundDescription':
    'Die Adresse hat sich möglicherweise geändert oder die Seite ist in dieser Konsole nicht verfügbar.',
  'auth.backHome': 'Zurück zur Startseite',

  'common.cancel': 'Abbrechen',
  'common.close': 'Schließen',
  'common.save': 'Speichern',
  'common.retry': 'Erneut versuchen',
  'common.loading': 'Wird geladen…',
  'language.label': 'Sprache',
  'language.preview': 'Vorschau · Übersetzungen unvollständig',
  'runtime.disabledTitle': 'Konsole deaktiviert',
  'runtime.disabledDescription': 'Diese Konsole ist in der Konfiguration der Instanz deaktiviert.',
  'runtime.classic': 'Klassische Rancher-Oberfläche öffnen',
  'environment.selected': 'Umgebung: {name}',
  'selection.count': { one: '{count} ausgewählter Eintrag', other: '{count} ausgewählte Einträge' },

  'shell.nav.overview.title': 'Übersicht',
  'shell.nav.overview.description': 'Ressourcen und Kontext der ausgewählten Umgebung.',
  'shell.nav.environments.title': 'Umgebungen',
  'shell.nav.environments.description':
    'Organisieren Sie Ressourcen und greifen Sie auf Ihre Umgebungen zu.',
  'shell.nav.stacks.title': 'Stacks',
  'shell.nav.stacks.description': 'Anwendungen und Gruppen von Diensten.',
  'shell.nav.services.title': 'Dienste',
  'shell.nav.services.description': 'Dienste, Lastverteiler und Diensterkennung.',
  'shell.nav.containers.title': 'Container',
  'shell.nav.containers.description': 'Instanzen, Status und Lebenszyklusaktionen.',
  'shell.nav.hosts.title': 'Hosts',
  'shell.nav.hosts.description': 'Kapazität und Infrastruktur der Umgebungen.',
  'shell.nav.volumes.title': 'Volumes',
  'shell.nav.volumes.description': 'Speicher und Ressourcenzuordnungen.',
  'shell.nav.registries.title': 'Registries',
  'shell.nav.registries.description': 'Image-Quellen und Anmeldedaten.',
  'shell.nav.secrets.title': 'Secrets',
  'shell.nav.secrets.description': 'Metadaten und Konfiguration von Secrets.',
  'shell.nav.certificates.title': 'Zertifikate',
  'shell.nav.certificates.description': 'Zertifikate und Gültigkeit.',
  'shell.nav.catalog.title': 'Katalog',
  'shell.nav.catalog.description': 'Verfügbare Vorlagen für Ihre Anwendungen.',
  'shell.nav.groups.title': 'Gruppen',
  'shell.nav.groups.description': 'Verwalten Sie Mitglieder und Umgebungsberechtigungen zentral.',
  'shell.nav.users.title': 'Benutzer',
  'shell.nav.users.description': 'Konten und Mitgliedschaft in lokalen Gruppen.',
  'shell.nav.audit.title': 'Audit',
  'shell.nav.audit.description': 'Administrative Ereignisse und Änderungen.',
  'shell.nav.processes.title': 'Prozesse',
  'shell.nav.processes.description': 'Prozessausführungen und Fehler.',
  'shell.nav.catalogRepositories.title': 'Katalog-Repositories',
  'shell.nav.catalogRepositories.description': 'Globale Git-Quellen für Vorlagen.',
  'shell.nav.drivers.title': 'Maschinentreiber',
  'shell.nav.drivers.description': 'Anbieter und Treiber für die Bereitstellung.',
  'shell.nav.ha.title': 'Hochverfügbarkeit und Cluster',
  'shell.nav.ha.description': 'Vom Server gemeldete Mitglieder und Heartbeats.',
  'shell.nav.settings.title': 'Konfiguration',
  'shell.nav.settings.description': 'Servereinstellungen und Parameter.',
  'shell.nav.apiKeys.title': 'API-Schlüssel',
  'shell.nav.apiKeys.description': 'Anmeldedaten und autorisierte Geltungsbereiche.',
  'shell.nav.webhooks.title': 'Webhooks',
  'shell.nav.webhooks.description': 'Empfänger und Ereignisintegrationen.',
  'shell.section.operations': 'BETRIEB',
  'shell.section.infrastructure': 'INFRASTRUKTUR',
  'shell.section.administration': 'VERWALTUNG',
  'shell.section.integrations': 'INTEGRATIONEN',
  'shell.section.account': 'IHR KONTO',
  'shell.appearance.title': 'Ihr Erscheinungsbild',
  'shell.appearance.description': 'Einstellungen, die für alle Seiten dieser Konsole gelten.',
  'shell.appearance.done': 'Fertig',
  'shell.appearance.light': 'Hell',
  'shell.appearance.dark': 'Dunkel',
  'shell.appearance.system': 'System',
  'shell.appearance.managed': 'Das Design wird vom Administrator festgelegt.',
  'shell.appearance.density': 'Dichte',
  'shell.appearance.comfortable': 'Komfortabel',
  'shell.appearance.compact': 'Kompakt',
  'shell.access.title': 'Ihr Zugriff',
  'shell.access.waiting': 'Warten auf die Freigabe des Zugriffs.',
  'shell.access.pending': 'Zugriff ausstehend',
  'shell.disabled.title': 'Konsole deaktiviert',
  'shell.disabled.description':
    'Die moderne Konsole ist in der Konfiguration dieser Instanz deaktiviert.',
  'shell.classic.open': 'Klassische Rancher-Oberfläche öffnen',
  'shell.classic.title': 'Klassische Rancher-Oberfläche',
  'shell.skipContent': 'Zum Inhalt springen',
  'shell.navigation.close': 'Navigation schließen',
  'shell.navigation.main': 'Hauptnavigation',
  'shell.navigation.home': 'Startseite',
  'shell.navigation.expand': 'Menü erweitern',
  'shell.navigation.collapse': 'Menü reduzieren',
  'shell.navigation.open': 'Navigation öffnen',
  'shell.theme.light': 'Helles Design verwenden',
  'shell.theme.dark': 'Dunkles Design verwenden',
  'shell.user.menu': 'Benutzermenü',
  'shell.user.name': 'Benutzer',
  'shell.user.admin': 'Administrator',
  'shell.user.access': 'Mein Zugriff',
  'shell.user.appearance': 'Erscheinungsbild',
  'shell.user.about': 'Über diese Konsole',
  'shell.user.signingOut': 'Abmeldung läuft…',
  'shell.user.signOut': 'Abmelden',
  'shell.user.account': 'Mein Konto',
  'shell.footer.modern': 'Moderne Konsole',
  'shell.story.eyebrow': 'INFRASTRUKTUR IM KONTEXT',
  'shell.story.environment': 'Ihre Umgebung.',
  'shell.story.view': 'Ein klarer Überblick.',
  'shell.story.description': 'Ressourcen, Anwendungen und Zugriff in einer vernetzten Oberfläche.',
  'shell.story.secure': 'Sicherer Zugriff auf Ihre Infrastruktur.',
  'shell.environment.none': 'Kein Zugriff',
  'shell.environment.label': 'Umgebung: {name}',
  'shell.environment.caption': 'UMGEBUNG',
  'shell.environment.select': 'Umgebung auswählen',
  'shell.environment.switch': 'Umgebung wechseln',
  'shell.environment.availableCount': { one: '{count} verfügbar', other: '{count} verfügbar' },
  'shell.environment.search': 'Umgebungen suchen',
  'shell.environment.placeholder': 'Nach Namen suchen…',
  'shell.environment.available': 'Verfügbare Umgebungen',
  'shell.environment.active': 'Aktiv',
  'shell.environment.inactive': 'Inaktiv',
  'shell.environment.current': 'Aktuelle Umgebung',
  'shell.environment.empty': 'Keine Umgebungen gefunden.',
  'shell.environment.manage': 'Umgebungen verwalten',
  'shell.environment.authorized': 'Wählen Sie eine autorisierte Umgebung aus.',

  'recovery.moduleTitle': 'Diese Seite konnte nicht geladen werden',
  'recovery.renderTitle': 'Diese Seite konnte nicht geöffnet werden',
  'recovery.moduleDescription':
    'Die Konsole wurde möglicherweise aktualisiert oder die Verbindung wurde unterbrochen. Laden Sie die Konsole neu, um die aktuelle Version abzurufen. Nicht gespeicherte Änderungen in diesem Tab können verloren gehen.',
  'recovery.renderDescription':
    'Ein Fehler in der Benutzeroberfläche ist aufgetreten. Sie können einen anderen Bereich öffnen oder diese Seite neu laden. Nicht gespeicherte Änderungen in diesem Tab können verloren gehen.',
  'recovery.reload': 'Konsole neu laden',
} as const;
