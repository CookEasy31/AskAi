require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configure Multer for file uploads (store in memory)
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 } // Increased to 100MB limit
});

// --- Initialize Google Generative AI ---
if (!process.env.GOOGLE_API_KEY) {
    console.error("FEHLER: GOOGLE_API_KEY ist nicht in der .env-Datei gesetzt!");
    process.exit(1);
}
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// Available models
const MODELS = {
    GEMINI_2_0: "gemini-2.0-flash-001",
    GEMINI_2_5: "gemini-2.5-flash-preview-04-17"
};

// --- API Endpoint ---
app.post('/generate', upload.single('inputFile'), async (req, res) => {
    console.log('Received generation request');
    
    try {
        const { topic, format, length, creativityLevel, content, description, modelChoice } = req.body;
        
        // Select model based on user choice, default to GEMINI_2_0
        const selectedModelName = modelChoice === 'gemini-2.5' ? MODELS.GEMINI_2_5 : MODELS.GEMINI_2_0;
        console.log(`Using model: ${selectedModelName}`);
        
        const model = genAI.getGenerativeModel({ model: selectedModelName });
        
        let fileContent = '';
        let fileType = '';
        
        // Check if a file was uploaded
        if (req.file) {
            console.log(`File uploaded: ${req.file.originalname}, size: ${req.file.size} bytes, type: ${req.file.mimetype}`);
            fileType = req.file.mimetype;
            
            // Handle different file types
            if (fileType.startsWith('text/') || req.file.originalname.endsWith('.md')) {
                // Text files can be processed directly
                fileContent = req.file.buffer.toString('utf-8');
                console.log('Processing text file content');
            } else if (fileType.startsWith('image/')) {
                // For image files, we'll prepare for multimodal input
                // The file will be handled directly by the API
                console.log('Image file detected - will be processed by multimodal capability');
                
                // Check if file size is too large for API
                if (req.file.size > 20 * 1024 * 1024) {
                    console.warn('Image size warning: File exceeds 20MB which may cause processing issues');
                }
                
            } else if (fileType === 'application/pdf') {
                console.log('PDF file detected - will be processed by multimodal capability');
                // PDFs will be handled directly by the API
                
                // Check if file size is too large for API
                if (req.file.size > 20 * 1024 * 1024) {
                    console.warn('PDF size warning: File exceeds 20MB which may cause processing issues');
                    
                    // For very large PDFs, add a warning in the response
                    if (req.file.size > 20 * 1024 * 1024) {
                        return res.status(400).json({ 
                            error: 'PDF Datei zu groß', 
                            details: 'Die PDF-Datei ist größer als 20MB, was zu Verarbeitungsproblemen führen kann. Bitte verwenden Sie eine kleinere Datei oder extrahieren Sie den relevanten Text.'
                        });
                    }
                }
            } else {
                return res.status(400).json({ 
                    error: 'Nicht unterstützter Dateityp', 
                    details: 'Unterstützte Formate sind Text, Markdown, Bilder (JPG, PNG) und PDF.' 
                });
            }
        }

        // --- Input Validation ---
        if (!topic && !req.file) {
            return res.status(400).json({ error: 'Bitte geben Sie einen Titel ein, wenn keine Datei hochgeladen wird.' });
        }
        
        if (!content && !req.file) {
            return res.status(400).json({ error: 'Bitte geben Sie ein Thema ein oder laden Sie eine Datei hoch.' });
        }

        // --- Construct the LLM Prompt ---
        const promptParts = [];
        
        // Customize prompt based on creativity level
        const creativityLevelNum = parseInt(creativityLevel) || 3;
        let creativityInstructions = '';
        
        // Set word count based on length parameter
        let wordCountTarget = '';
        switch(length) {
            case 'Brief':
                wordCountTarget = 'Erstellen Sie einen kurzen Text mit 150-200 Wörtern.';
                break;
            case 'Standard':
                wordCountTarget = 'Erstellen Sie einen Text mit mittlerer Länge von 400-600 Wörtern.';
                break;
            case 'Detailed':
                wordCountTarget = 'Erstellen Sie einen ausführlichen Text mit 800-1200 Wörtern.';
                break;
            default:
                wordCountTarget = 'Erstellen Sie einen Text mit mittlerer Länge von 400-600 Wörtern.';
        }
        
        if (creativityLevelNum <= 2) {
            // Conservative styling
            creativityInstructions = `
Für diesen niedrigen Kreativitätsgrad (${creativityLevelNum}/6) erstellen Sie ein konservatives, professionelles Design:
- Verwenden Sie eine zurückhaltende Farbpalette mit maximal 2-3 Farben
- Klare, leserliche Schriftarten ohne verspielte Elemente
- Traditionelles Layout mit klarer Hierarchie
- Minimale Animationen oder Effekte
- Fokus auf Lesbarkeit und klare Informationsvermittlung`;
        } else if (creativityLevelNum <= 4) {
            // Moderate styling
            creativityInstructions = `
Für diesen mittleren Kreativitätsgrad (${creativityLevelNum}/6) erstellen Sie ein modernes, ansprechendes Design:
- Ausgewogene Farbpalette mit 3-4 harmonischen Farben
- Moderne Typografie mit guter Lesbarkeit
- Zeitgemäßes Layout mit visuellen Akzenten
- Dezente Animationen und Hover-Effekte
- Gute Balance zwischen Ästhetik und Funktionalität`;
        } else {
            // Highly creative styling (levels 5-6)
            creativityInstructions = `
Für diesen hohen Kreativitätsgrad (${creativityLevelNum}/6) erstellen Sie ein auffallend kreatives, innovatives Design im Stil moderner Tech-Startups oder Premium-Produktseiten:
- Mutige, lebendige Farbpalette mit Farbverläufen und verschiedenen Schattierungen
- Experimentelle Typografie und kreative Schriftkombinationen
- Innovative Layout-Strukturen mit asymmetrischen Elementen
- Ausgefeilte Animationen, Parallax-Effekte und interaktive Elemente
- Sich überlappende Elemente und kreative visuelle Hierarchien
- Inspiration von modernen Websites wie Apple, StudySmarter oder führenden Münchner Startups
- Verschiedene UI-Komponenten wie Cards, Tabs, Accordions, etc.
- Einzigartige visuelle Elemente wie illustrierte Icons, Wellenformen oder geometrische Muster
- Überraschende interaktive Details, die das Nutzererlebnis bereichern
- Mutiges, aber zweckmäßiges Design, das dennoch die Inhalte optimal präsentiert`;
        }
        
        // Add text prompt
        let textPrompt = `
WICHTIGER HINWEIS ZUR AUSGABESTRUKTUR: Sie MÜSSEN Ihre Antwort in genau diesem Format strukturieren:
1. Beginnen Sie mit dem Tag <generated_html>
2. Dann kommt das HTML-Dokument
3. Beenden Sie mit dem Tag </generated_html>
4. Direkt danach folgt <design_explanation>
5. Dann kommt die Erklärung zum Design
6. Beenden Sie mit </design_explanation>

Wenn Sie dieses Format nicht einhalten, wird die Anfrage fehlschlagen. Dies ist essentiell.

Sie haben die Aufgabe, ein vollständiges HTML-Dokument mit eingebettetem CSS für eine Webseite zu generieren. Inhalt und Design sollten auf die vorgegebenen Eingaben zugeschnitten sein. Befolgen Sie diese Anweisungen sorgfältig:

1. Beginnen Sie mit der standardmäßigen HTML5-Dokumentstruktur, einschließlich <!DOCTYPE html>, <html lang="de">, <head> und <body> Tags.

2. Sie arbeiten mit den folgenden Eingabevariablen:
   <format>${format || 'Report'}</format> - Die Art des Inhalts
   <length>${length || 'Standard'}</length> - Die gewünschte Länge des Inhalts
   <creativity_level>${creativityLevel || '3'}</creativity_level> - Das anzuwendende Kreativitätsniveau (1-6)
   <topic>${topic}</topic> - Das Hauptthema des Inhalts
   <description>${description || ''}</description> - Zusätzliche Beschreibung (falls vorhanden)
   
   ${content ? `<user_content>${content}</user_content> - Vom Benutzer eingegebener Inhalt zum Thema` : ''}
   ${fileContent ? `<file_content>${fileContent}</file_content> - Inhalt der hochgeladenen Textdatei` : ''}
   ${req.file && !fileContent ? `<file_type>${fileType}</file_type> - Die hochgeladene Datei ist vom Typ ${req.file.originalname.split('.').pop()}` : ''}

3. Im <head>-Abschnitt:
   a. Setzen Sie einen passenden <title> basierend auf dem Thema und Format.
   b. Erstellen Sie ein <style>-Tag für Ihr CSS.
   c. Fügen Sie Metadaten und Viewport-Einstellungen hinzu.
   d. Binden Sie bei Bedarf Google Fonts ein (bevorzugen Sie moderne Schriften wie Inter, Roboto, Montserrat, Poppins usw.).

4. Für den Inhalt und Umfang des Textes:
   ${wordCountTarget}
   Halten Sie sich eng an diesen Umfang, um eine optimale Lesbarkeit für den gewählten Zweck zu gewährleisten.

5. Für das CSS-Styling:
   a. Verwenden Sie CSS-Variablen für Farben und definieren Sie eine zum Thema passende Farbpalette.
   b. Erstellen Sie ein responsives Layout mit Flexbox oder Grid.
   c. Gestalten Sie Typografie, Abstände und Komponenten entsprechend dem Kreativitätsniveau.
   d. Fügen Sie Media Queries für die mobile Responsivität hinzu.

${creativityInstructions}

6. Im <body>-Abschnitt:
   a. Erstellen Sie eine für das angegebene Format geeignete Struktur.
   b. Generieren Sie relevanten Inhalt basierend auf dem Thema, der Beschreibung und den bereitgestellten Inhalten.
   c. Das Format beeinflusst die Struktur:
      - "Report": Strukturierte Darstellung mit Überschriften, Abschnitten, möglicherweise Diagrammen oder Tabellen
      - "Summary": Konzentrierte Zusammenfassung mit Kernpunkten, möglicherweise als Liste oder Cards
      - "Technical": Technische Dokumentation mit Code-Beispielen, Definitionen, möglicherweise Diagrammen 
      - "Creative": Expressive Darstellung mit visuellen Elementen, kreativer Typografie und Layout
      - "Blog": Artikel-Format mit Einleitung, Hauptteil, Fazit, eventuell Bildern und Zitaten

7. Wenn eine Datei hochgeladen wurde:
   - Bei Textdateien: Berücksichtigen Sie deren Inhalt bei der Erstellung
   - Bei Bildern/PDFs: Erwähnen Sie diese und integrieren Sie das Thema in die Darstellung

8. Stellen Sie sicher, dass das Design responsiv und zugänglich ist:
   a. Verwenden Sie semantische HTML-Tags.
   b. Fügen Sie geeignete ARIA-Attribute hinzu.
   c. Stellen Sie sicher, dass der Farbkontrast den WCAG-Standards entspricht.

Generieren Sie sinnvollen, themenrelevanten deutschen Inhalt ohne Platzhaltertexte wie "Lorem ipsum". Alle Kommentare, Klassennamen und Inhalte sollten auf Deutsch sein.

WICHTIGE WIEDERHOLUNG: Ihre Antwort MUSS exakt in diesem Format sein:

<generated_html>
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <title>Beispiel-Titel</title>
    <!-- Rest des HTML-Codes -->
</head>
<body>
    <!-- Weiterer HTML-Code -->
</body>
</html>
</generated_html>

<design_explanation>
Hier folgt die Erklärung des Designs und der Designentscheidungen.
</design_explanation>

Stellen Sie sicher, dass Sie genau diese Tags verwenden und dass der HTML-Code vollständig und fehlerfrei ist.
`;
        promptParts.push({ text: textPrompt });
        
        // For image and PDF files, add them as image parts to the prompt
        if (req.file && (fileType.startsWith('image/') || fileType === 'application/pdf')) {
            promptParts.push({
                inlineData: {
                    mimeType: fileType,
                    data: req.file.buffer.toString('base64')
                }
            });
            
            // Add additional instructions for images/PDFs
            promptParts.push({
                text: `\nBitte analysieren Sie den Inhalt der hochgeladenen ${fileType.startsWith('image/') ? 'Bilddatei' : 'PDF-Datei'} und beziehen Sie die relevanten Informationen daraus in den generierten Inhalt ein. Vergessen Sie nicht, Ihre Antwort im erforderlichen Format mit <generated_html>...</generated_html> und <design_explanation>...</design_explanation> zu strukturieren.`
            });
        }

        // --- Call the LLM API ---
        console.log('Sending request to Generative AI model...');
        const genAIRequest = { contents: [{ parts: promptParts }] };
        
        // For debugging:
        // console.log('API Request:', JSON.stringify(genAIRequest, null, 2));
        
        // Set a timeout for the API request
        let apiTimeout;
        const timeoutPromise = new Promise((_, reject) => {
            apiTimeout = setTimeout(() => {
                reject(new Error('API-Anfrage-Timeout: Die Verarbeitung hat zu lange gedauert. Versuchen Sie es mit einer kleineren Datei.'));
            }, 120000); // 2 minute timeout
        });
        
        try {
            // Race between the API request and the timeout
            const result = await Promise.race([
                model.generateContent(genAIRequest),
                timeoutPromise
            ]);
            
            // Clear the timeout if the API request succeeded
            clearTimeout(apiTimeout);
            
            const response = await result.response;
            const rawOutput = response.text();
            console.log('Received response from model.');
        
            // --- Extract the HTML from the response ---
            const htmlMatch = rawOutput.match(/<generated_html>([\s\S]*?)<\/generated_html>/);
            const explanationMatch = rawOutput.match(/<design_explanation>([\s\S]*?)<\/design_explanation>/);
            
            if (htmlMatch && htmlMatch[1]) {
                const generatedHtml = htmlMatch[1].trim();
                const explanation = explanationMatch ? explanationMatch[1].trim() : 'Keine Erklärung vom Modell erhalten.';
                
                console.log('Successfully extracted HTML.');
                
                // --- Send Response to Frontend ---
                res.json({ 
                    generatedHtml: generatedHtml,
                    explanation: explanation 
                });
            } else {
                console.error('Could not extract HTML from model response.');
                console.log('Raw output from model:', rawOutput.substring(0, 500) + '...');
                
                // Attempt to extract HTML even if not in the exact format
                let generatedHtml = '';
                let explanation = '';
                
                // Check if output contains HTML
                if (rawOutput.includes('<!DOCTYPE html>')) {
                    const docTypeIndex = rawOutput.indexOf('<!DOCTYPE html>');
                    const htmlEndIndex = rawOutput.lastIndexOf('</html>');
                    
                    if (htmlEndIndex > docTypeIndex) {
                        generatedHtml = rawOutput.substring(docTypeIndex, htmlEndIndex + 7).trim();
                        console.log('Extracted HTML using fallback method.');
                        
                        // Try to extract explanation from the remaining text
                        const remainingText = rawOutput.substring(htmlEndIndex + 7).trim();
                        if (remainingText.length > 0) {
                            explanation = remainingText;
                        } else {
                            explanation = 'Keine Erklärung vom Modell erhalten.';
                        }
                        
                        // Send response with the extracted HTML
                        return res.json({
                            generatedHtml: generatedHtml,
                            explanation: explanation
                        });
                    }
                }
                
                throw new Error('Das Modell hat kein gültiges HTML im erwarteten Format zurückgegeben. Bitte versuchen Sie es erneut.');
            }
        } catch (timeoutError) {
            clearTimeout(apiTimeout);
            throw timeoutError;
        }
    } catch (error) {
        console.error("Error during generation:", error);
        let errorMessage = 'Fehler bei der Generierung der Webseite.';
        
        if (error.message.includes('timeout') || error.message.includes('Timeout')) {
            errorMessage = 'Timeout bei der Verarbeitung. Die Datei ist möglicherweise zu groß oder komplex.';
        } else if (error.message.includes('quota')) {
            errorMessage = 'API-Kontingent überschritten. Bitte überprüfen Sie Ihr Google AI-Konto.';
        } else if (error.message.includes('API key')) {
            errorMessage = 'Ungültiger oder fehlender API-Schlüssel. Bitte überprüfen Sie die .env-Datei.';
        } else if (error.message.includes('extract HTML')) {
            errorMessage = error.message;
        } else if (error.message.includes('File too large')) {
            errorMessage = 'Die hochgeladene Datei ist zu groß. Maximale Größe: 100MB.';
        } else if (error.message.includes('CONTENT_BLOCKED')) {
            errorMessage = 'Der Inhalt wurde vom Sicherheitssystem blockiert. Bitte überprüfen Sie Ihre Eingabe auf unangemessene Inhalte.';
        } else if (error.message.includes('SAFETY')) {
            errorMessage = 'Der Inhalt wurde aus Sicherheitsgründen abgelehnt. Bitte überprüfen Sie Ihre Eingabe.';
        }
        
        // Log full error details for debugging
        console.error('Detailed error info:', {
            message: error.message,
            stack: error.stack,
            name: error.name,
            code: error.code
        });
        
        res.status(500).json({ error: errorMessage, details: error.message });
    }
});

// --- Start Server ---
app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
}); 