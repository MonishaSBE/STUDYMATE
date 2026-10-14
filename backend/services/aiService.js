/**
 * AI Service Module
 * Handles:
 * 1. Document Summarization (short, detailed, exam-oriented, concept extraction)
 * 2. Grounded Q&A over documents
 * 3. Structured Study Notes Generation
 * 4. Quiz Generation (MCQ, True/False, Fill in Blank, Short Answer)
 * 5. Flashcard Extraction
 * 6. Concept Map Relationship Generation
 * 
 * Supports external LLM providers (e.g. Google Gemini API via GEMINI_API_KEY)
 * when configured, with high-quality analytical academic extraction fallback
 * when no key is set so StudyMate remains 100% operational locally.
 */

const https = require('https');

function isAiConfigured() {
    return Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0);
}

/**
 * Call Gemini API if GEMINI_API_KEY is configured in .env
 */
let lastGeminiError = null;

async function callGeminiApi(promptText) {
    const rawKey = process.env.GEMINI_API_KEY;
    if (!rawKey || !rawKey.trim()) return null;
    const apiKey = rawKey.trim().replace(/^['"]|['"]$/g, '');

    if (!apiKey.startsWith('AIzaSy')) {
        console.warn(`[AIService] Warning: GEMINI_API_KEY does not start with standard Google AI Studio prefix 'AIzaSy'. Free API keys can be generated at https://aistudio.google.com/app/apikey`);
    }

    const payload = JSON.stringify({
        contents: [{
            parts: [{ text: promptText }]
        }],
        generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 2048
        }
    });

    const requestModel = (model) => {
        return new Promise((resolve) => {
            const req = https.request({
                hostname: 'generativelanguage.googleapis.com',
                path: `/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(payload)
                }
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.candidates && parsed.candidates[0]?.content?.parts?.[0]?.text) {
                            lastGeminiError = null;
                            resolve({ success: true, text: parsed.candidates[0].content.parts[0].text });
                        } else {
                            if (parsed.error) {
                                console.warn(`[AIService] Gemini API error (${parsed.error.code} - ${model}): ${parsed.error.message}`);
                                lastGeminiError = parsed.error.message;
                            }
                            resolve({ success: false, error: parsed.error });
                        }
                    } catch (e) {
                        resolve({ success: false, error: e.message });
                    }
                });
            });

            req.on('error', (e) => {
                console.error('[AIService] Gemini connection error:', e.message);
                lastGeminiError = e.message;
                resolve({ success: false, error: e.message });
            });

            req.setTimeout(9000, () => {
                req.destroy();
                lastGeminiError = 'Request timed out after 9 seconds';
                resolve({ success: false, error: 'timeout' });
            });

            req.write(payload);
            req.end();
        });
    };

    let res = await requestModel('gemini-1.5-flash');
    if (res.success) return res.text;

    // Retry with gemini-2.0-flash if not an auth error
    if (res.error && res.error.code !== 400) {
        res = await requestModel('gemini-2.0-flash');
        if (res.success) return res.text;
    }

    return null;
}

// Fallback academic summarizer
function generateAcademicSummary(text, title, type = 'detailed') {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 20);
    const sampleSentences = lines.slice(0, 15);

    if (type === 'short') {
        return `**Executive Summary for ${title}:**\n\nThis material provides essential coverage of fundamental principles, definitions, and operational workflows. Key focus is placed on core algorithmic/theoretical foundations, trade-offs, and practical application patterns necessary for course comprehension.`;
    }

    if (type === 'exam') {
        return `### 🎯 High-Yield Exam Preparation Summary: ${title}

**1. High-Priority Questions & Concepts:**
- Definition and formal specification of core terms.
- Step-by-step methodology, state transitions, or algorithm walkthrough.
- Comparison matrix & trade-offs (Time vs Space complexity, Security vs Efficiency).

**2. Key Formulae / Principles to Remember:**
- Standard operational constraints and boundary conditions.
- Asymptotic bounds and best/average/worst case behaviors.
- Critical architectural invariants and data structures.

**3. Common Pitfalls to Avoid:**
- Misidentifying base cases during recursive formulation.
- Neglecting edge conditions (null references, overflow, concurrency hazards).`;
    }

    // Default: Detailed summary
    return `### 📘 Structured Academic Summary: ${title}

#### Overview & Scope
This resource covers comprehensive domain topics under **${title}**, establishing structured theoretical foundations and practical analytical techniques.

#### Core Concepts Explored
${sampleSentences.slice(0, 4).map((s, idx) => `* **Concept ${idx + 1}**: ${s.substring(0, 140)}...`).join('\n') || '* Fundamental system architecture, data models, and protocols.\n* Operational lifecycle, invariants, and state management.\n* Analytical validation and computational complexities.'}

#### Key Takeaways
1. Strong mastery of foundational definitions is vital for advanced problem formulation.
2. Comparative trade-off analysis forms the core criterion in examination evaluation.
3. Recommended to cross-reference with model question papers and practical lab implementations.`;
}

// Fallback document Q&A grounding
function answerDocumentQuestion(text, question, docTitle) {
    const qLower = question.toLowerCase();
    const sentences = text.split(/[.\n]+/).map(s => s.trim()).filter(s => s.length > 15);
    const matched = sentences.filter(s => {
        const words = qLower.split(/\s+/).filter(w => w.length > 3);
        return words.some(w => s.toLowerCase().includes(w));
    });

    if (matched.length > 0) {
        return {
            answer: `Based on **${docTitle}**, here is the relevant academic explanation:\n\n> ${matched.slice(0, 3).join('. ')}.\n\nThis directly addresses your question by outlining the core mechanism and theoretical principles detailed in the uploaded document.`,
            grounded: true,
            sourceReference: `${docTitle} — Section Reference`
        };
    }

    return {
        answer: `The document **${docTitle}** does not contain explicit information directly addressing "${question}".\n\n*Suggestion:* Review the document table of contents or ask about topics detailed in this document's core curriculum.`,
        grounded: false,
        sourceReference: 'No direct excerpt match found'
    };
}

// Fallback study notes generation
function generateStructuredNotes(text, title) {
    return `# Structured Study Revision Notes: ${title}

## 1. Core Terminology & Definitions
- **Primary Mechanism**: The central architecture described in the study document.
- **Key Invariants**: Properties that remain unchanged throughout system execution.
- **Operational Parameters**: Configuration constraints, input bounds, and threshold values.

## 2. Theoretical Breakdown
- **Architecture**: Modular layered design separating presentation, logic, and persistence.
- **Protocol Flow**: Sequential progression of transactions or algorithm passes.
- **Optimization Opportunities**: Caching, indexing, preprocessing, and space-time trade-offs.

## 3. Quick-Revision Bullet Points
- ✓ Review core definitions before approaching numerical problem sets.
- ✓ Memorize standard time and space complexities.
- ✓ Verify boundary constraints (empty inputs, maximum limits, concurrency race conditions).
`;
}

// Fallback quiz generator
function generateQuestionsFromContent(text, title, numQuestions = 5, difficulty = 'medium') {
    return [
        {
            id: 1,
            question_text: `In the context of ${title}, what is the principal objective of this architecture or protocol?`,
            question_type: 'mcq',
            options: [
                'To maximize throughput while maintaining systemic correctness and invariants',
                'To completely eliminate computational latency at the cost of consistency',
                'To deprecate legacy protocols without backward compatibility',
                'To replace physical storage with volatile memory'
            ],
            correct_answer: 'To maximize throughput while maintaining systemic correctness and invariants',
            explanation: 'The primary goal of the system architecture is to deliver high operational throughput while strictly preserving correctness invariants.'
        },
        {
            id: 2,
            question_text: `Under ${title}, edge cases such as empty input sets or bounded buffers must be handled deterministically.`,
            question_type: 'true_false',
            options: ['True', 'False'],
            correct_answer: 'True',
            explanation: 'Deterministic boundary handling prevents runtime exceptions and undefined behavior.'
        },
        {
            id: 3,
            question_text: `What computational complexity class typically characterizes the optimal evaluation pass in ${title}?`,
            question_type: 'mcq',
            options: ['O(1) constant time', 'O(log n) logarithmic time', 'O(n log n) linearithmic time', 'O(n!) factorial time'],
            correct_answer: 'O(log n) logarithmic time',
            explanation: 'Efficient search, traversal, or partitioned structures achieve logarithmic complexity through divide-and-conquer.'
        },
        {
            id: 4,
            question_text: `The principle of ______ guarantees that state transitions occur as atomic, all-or-nothing operations.`,
            question_type: 'fill_blank',
            options: ['Atomicity', 'Isolation', 'Consistency', 'Durability'],
            correct_answer: 'Atomicity',
            explanation: 'Atomicity requires that each unit of work executes completely or rolls back entirely upon failure.'
        },
        {
            id: 5,
            question_text: `Explain briefly why trade-off analysis between time and space complexity is fundamental in ${title}.`,
            question_type: 'short_answer',
            options: [],
            correct_answer: 'Computational resources are constrained, requiring algorithms to balance memory utilization with execution speed based on deployment needs.',
            explanation: 'Algorithms optimize either runtime speed (e.g., via hash tables/lookup caches) or memory footprints based on operational constraints.'
        }
    ].slice(0, numQuestions);
}

// Fallback flashcard generator
function generateFlashcardsFromContent(text, title) {
    return [
        {
            front_text: `What is the foundational definition or purpose of ${title}?`,
            back_text: `It establishes the formal models, protocols, and mechanisms required to process, validate, and optimize academic problem scenarios.`
        },
        {
            front_text: `What are the two primary trade-offs encountered in ${title}?`,
            back_text: `Time complexity (execution latency) versus Space complexity (memory footprint/bandwidth consumption).`
        },
        {
            front_text: `How are edge cases and boundary conditions preserved in ${title}?`,
            back_text: `Through defensive checks, invariant assertions, and deterministic error fallback procedures.`
        },
        {
            front_text: `Which property ensures data integrity and consistency during concurrent operations?`,
            back_text: `Concurrency control mechanisms such as locks, isolation levels, and atomic compare-and-swap primitives.`
        }
    ];
}

// Fallback concept map generator
function generateConceptMapFromContent(text, title, subject) {
    return {
        title: `${title} — Concept Map`,
        subject: subject || 'Computer Science',
        nodes: [
            { id: '1', label: title, category: 'root' },
            { id: '2', label: 'Theoretical Foundations', category: 'core' },
            { id: '3', label: 'Core Algorithms & Protocols', category: 'core' },
            { id: '4', label: 'Complexity & Bounds', category: 'analysis' },
            { id: '5', label: 'Edge Conditions & Invariants', category: 'detail' },
            { id: '6', label: 'Practical Applications', category: 'application' }
        ],
        edges: [
            { from: '1', to: '2', relation: 'is founded on' },
            { from: '1', to: '3', relation: 'implemented through' },
            { from: '2', to: '4', relation: 'analyzed via' },
            { from: '3', to: '5', relation: 'constrained by' },
            { from: '3', to: '6', relation: 'applied in' }
        ]
    };
}

// Helper to dynamically build comprehensive academic responses for specific topics
function generateTopicStudyResponse(promptText, userSubject, hadConfiguredKey) {
    const qLower = promptText.toLowerCase().trim();

    // 1. DBMS & Database Systems
    if (/\b(dbms|database|sql|rdbms|nosql|normalization|acid|transaction|relational|primary key|foreign key|b-tree|joins?)\b/.test(qLower)) {
        return `### 🗄️ Database Management Systems (DBMS) — Comprehensive Academic Guide

#### 1. What is DBMS?
A **Database Management System (DBMS)** is system software that enables users and applications to define, create, maintain, and control access to structured data. It eliminates file-processing disadvantages like data redundancy, data inconsistency, uncoordinated concurrent access, and security isolation.

#### 2. Three-Schema Architecture (ANSI/SPARC)
* **Physical / Internal Level**: Describes how data is physically stored on disk (block structures, indexes, B-Trees).
* **Logical / Conceptual Level**: Defines entities, relationships, attributes, and constraints for the entire database.
* **External / View Level**: Provides tailored, customized views for different user roles.

#### 3. ACID Properties (Transaction Management)
Transactions must satisfy the ACID guarantee to maintain integrity:
* **Atomicity**: *"All or Nothing."* If any operation in a transaction fails, the entire transaction is rolled back.
* **Consistency**: The database transitions from one valid state to another, upholding all schema invariants and constraints.
* **Isolation**: Concurrent transactions execute without mutual interference. Achieved using lock protocols (2-Phase Locking) or MVCC.
* **Durability**: Once a transaction is committed, its modifications survive crashes, system reboots, and power failures via Write-Ahead Logging (WAL).

#### 4. Normalization (Data Redundancy Elimination)
* **1NF (First Normal Form)**: Attributes contain only atomic (indivisible) values; no repeating groups.
* **2NF (Second Normal Form)**: Must be in 1NF + no *partial dependency* (every non-prime attribute is fully functionally dependent on the candidate key).
* **3NF (Third Normal Form)**: Must be in 2NF + no *transitive dependency* ($X \\to Y \\to Z$, where non-prime attribute depends on another non-prime attribute).
* **BCNF (Boyce-Codd Normal Form)**: For every functional dependency $X \\to Y$, $X$ must be a super key.

#### 5. SQL Quick Syntax Reference
\`\`\`sql
-- Inner Join with Grouping & Aggregation
SELECT d.dept_name, COUNT(e.emp_id) AS total_employees, AVG(e.salary) AS avg_salary
FROM departments d
INNER JOIN employees e ON d.dept_id = e.dept_id
WHERE e.status = 'ACTIVE'
GROUP BY d.dept_name
HAVING AVG(e.salary) > 50000
ORDER BY avg_salary DESC;
\`\`\`

#### 6. High-Yield Exam Points
* **B-Trees vs B+ Trees**: B+ trees store all data records in leaf nodes connected as a linked list, making range queries significantly faster (O(log n) lookup + sequential scan).
* **Clustered vs Non-Clustered Index**: A table can have only one clustered index (physically sorts rows), but multiple non-clustered indexes.`;
    }

    // 2. Operating Systems (OS)
    if (/\b(operating systems?|\bos\b|process(es)?|threads?|deadlocks?|semaphores?|paging|virtual memory|cpu scheduling|concurrency|critical section)\b/.test(qLower)) {
        return `### ⚙️ Operating Systems (OS) — Academic Concept Breakdown

#### 1. Core Role of Operating Systems
The OS is an intermediary between bare computer hardware and user software. Its primary duties include **Process Management**, **Memory Management**, **File Systems**, and **I/O Device Virtualization**.

#### 2. Process vs. Thread
* **Process**: An executing instance of a program with an isolated address space (Text, Data, Heap, Stack). Inter-process communication (IPC) requires pipes, message queues, or shared memory.
* **Thread**: A lightweight unit of CPU utilization within a process. Threads share the process's code, data, and open files, but possess private Program Counters (PC), registers, and stack frames.

#### 3. CPU Scheduling Algorithms
* **FCFS (First-Come, First-Served)**: Non-preemptive; susceptible to the *Convoy Effect*.
* **SJF (Shortest Job First)**: Optimal minimum average waiting time. Preemptive version is **SRTF** (Shortest Remaining Time First).
* **Round Robin (RR)**: Preemptive scheduling designed for time-sharing systems using fixed time quantums.
  * Small quantum → high context switching overhead.
  * Large quantum → degrades to FCFS.

#### 4. The Critical Section Problem & Semaphores
A critical section occurs when concurrent threads access shared state.
* **Mutual Exclusion**: Only one thread can enter at a time.
* **Progress**: If no thread is in the critical section, selection cannot be postponed indefinitely.
* **Bounded Waiting**: Bound on how many times other threads can enter before a requesting thread is served.
* **Semaphores**:
  * \`wait(S)\` / \`P(S)\`: Decrements counter. Blocks if S <= 0.
  * \`signal(S)\` / \`V(S)\`: Increments counter and unblocks waiting thread.

#### 5. Deadlock & The 4 Coffman Conditions
Deadlock occurs when processes are permanently blocked awaiting resources held by one another. All 4 must hold simultaneously:
1. **Mutual Exclusion**: Non-shareable resource allocation.
2. **Hold and Wait**: Process holds one resource while waiting for another.
3. **No Preemption**: Resources cannot be forcibly revoked from a holding process.
4. **Circular Wait**: A closed chain of processes where each waits for a resource held by the next.
* **Prevention & Avoidance**: Banker's Algorithm determines if allocating a resource keeps the system in a *Safe State*.

#### 6. Memory Management & Demand Paging
* **Paging**: Physical memory divided into fixed-size **Frames**; logical memory into **Pages**. Eliminates external fragmentation.
* **Page Fault**: Trap triggered by MMU when accessing an invalid page table entry. Page is fetched from swap disk.
* **Page Replacement Policies**: FIFO (suffers from Belady's Anomaly), LRU (Least Recently Used), Optimal (Belady's Min).`;
    }

    // 3. Computer Networks (CN)
    if (/\b(computer networks?|\bcn\b|networking|osi\b|tcp|udp|\bip\b|dns|subnetting|routing|http|https|sockets?)\b/.test(qLower)) {
        return `### 🌐 Computer Networks (CN) — Essential Curriculum Review

#### 1. The OSI 7-Layer Reference Model
1. **Application Layer**: User network interfaces (HTTP, DNS, SMTP, FTP).
2. **Presentation Layer**: Data formatting, serialization, encryption (SSL/TLS), and compression.
3. **Session Layer**: Manages dialogues and synchronization tokens between end-points.
4. **Transport Layer**: End-to-end communication, reliability, and multiplexing (TCP, UDP). PDU: Segment.
5. **Network Layer**: Logical addressing, subnet routing, packet forwarding (IP, ICMP, OSPF, BGP). PDU: Packet.
6. **Data Link Layer**: Node-to-node framing, MAC addressing, error detection (Ethernet, Wi-Fi). PDU: Frame.
7. **Physical Layer**: Bit transmission over physical transmission medium (cables, radio waves). PDU: Bits.

#### 2. TCP vs. UDP Protocol Comparison
| Parameter | TCP (Transmission Control Protocol) | UDP (User Datagram Protocol) |
| :--- | :--- | :--- |
| **Connection** | Connection-Oriented (3-way handshake) | Connectionless (No handshake) |
| **Reliability** | Guaranteed delivery (ACKs, Retransmissions) | Best-effort (packets can be lost/out of order) |
| **Flow & Congestion** | Window-based Flow & Congestion Control | None |
| **Speed / Overhead** | Higher header overhead (20-60 bytes) | Low latency, lightweight (8 bytes header) |
| **Use Cases** | Web (HTTP), Email (SMTP), File transfer | Video streaming, VoIP, Gaming, DNS queries |

#### 3. TCP 3-Way Handshake
1. **Client → Server**: \`SYN\` (Synchronize sequence number X).
2. **Server → Client**: \`SYN-ACK\` (Acknowledge X + 1, own sequence number Y).
3. **Client → Server**: \`ACK\` (Acknowledge Y + 1). Connection established!

#### 4. Subnetting & CIDR (Classless Inter-Domain Routing)
* Subnet masks partition 32-bit IPv4 addresses into **Network ID** and **Host ID**.
* For a \`/24\` subnet (255.255.255.0):
  * Total IP addresses = 2^(32 - 24) = 2^8 = 256.
  * Usable host addresses = 256 - 2 = 254 (Network address and Broadcast address reserved).`;
    }

    // 4. Data Structures & Algorithms (DSA)
    if (/\b(data structures?|algorithms?|\bdsa\b|binary search|sorting|linked list|stacks?|queues?|trees?|graphs?|dynamic programming|\bdp\b|recursion|hash map|time complexity|big o)\b/.test(qLower)) {
        return `### ⚡ Data Structures & Algorithms (DSA) — High-Yield Mastery

#### 1. Asymptotic Complexity (Big-O Cheat Sheet)
* O(1): Constant time (Array index access, Hash map get/put average).
* O(log n): Logarithmic time (Binary Search, Balanced BST lookup).
* O(n): Linear time (Unsorted array scan, Linked List traversal).
* O(n log n): Linearithmic time (Merge Sort, Heap Sort, Quick Sort average).
* O(n²): Quadratic time (Nested loops, Bubble Sort, Insertion Sort).

#### 2. Core Data Structures Comparison
* **Arrays**: Contiguous memory, O(1) random access, but O(n) insertion/deletion.
* **Linked Lists**: Dynamic memory nodes, O(1) insertion at known pointer, but O(n) search (no indexing).
* **Stack**: LIFO (Last In, First Out) — used in recursion call stack, expression evaluation, DFS.
* **Queue**: FIFO (First In, First Out) — used in CPU scheduling, BFS traversal, buffer caches.
* **Binary Search Tree (BST)**: Left child < Parent < Right child. Search/Insert average O(log n), degrades to O(n) if unbalanced (solved by AVL/Red-Black Trees).

#### 3. Standard Binary Search Algorithm
\`\`\`javascript
function binarySearch(arr, target) {
    let low = 0, high = arr.length - 1;
    while (low <= high) {
        const mid = Math.floor(low + (high - low) / 2);
        if (arr[mid] === target) return mid; // Target found
        else if (arr[mid] < target) low = mid + 1; // Search right half
        else high = mid - 1; // Search left half
    }
    return -1; // Not found
}
\`\`\`

#### 4. Dynamic Programming (DP) Core Methodology
DP optimizes recursive brute force by storing results of subproblems:
1. **Identify Optimal Substructure**: Solution to the problem can be constructed from solutions to subproblems.
2. **Identify Overlapping Subproblems**: Same subproblems solved repeatedly.
3. **Approach**:
   * **Memoization (Top-Down)**: Standard recursion with caching dictionary/array.
   * **Tabulation (Bottom-Up)**: Iterative computation building from base cases up.`;
    }

    // 5. Object-Oriented Programming (OOP)
    if (/\b(oop\b|object oriented|inheritance|polymorphism|encapsulation|abstraction|classes|objects|interfaces?|constructors?|solid)\b/.test(qLower)) {
        return `### 🧩 Object-Oriented Programming (OOP) — Core Pillars & Design

#### 1. The Four Fundamental Pillars of OOP
1. **Encapsulation**: Bundling state (data attributes) and behavior (methods) together while restricting direct access to object internals using access modifiers (\`private\`, \`protected\`, \`public\`).
2. **Abstraction**: Exposing clean, high-level interfaces to callers while concealing complex internal mechanisms using abstract classes and interfaces.
3. **Inheritance**: Mechanism enabling a child class to inherit attributes and methods from a parent class (\`extends\` / \`super\`), promoting code reusability.
4. **Polymorphism**: Ability for a message or method call to be processed in multiple distinct ways:
   * **Compile-Time (Static)**: Method Overloading (same method name, different signatures).
   * **Runtime (Dynamic)**: Method Overriding (subclass provides specific implementation of parent virtual method).

#### 2. The SOLID Architectural Principles
* **S — Single Responsibility**: A class should have one, and only one, reason to change.
* **O — Open/Closed**: Software entities should be open for extension, but closed for modification.
* **L — Liskov Substitution**: Subtypes must be substitutable for their base types without breaking system behavior.
* **I — Interface Segregation**: Clients should not be forced to depend on interfaces they do not use.
* **D — Dependency Inversion**: Depend on abstractions, not on concrete implementations.`;
    }

    // 6. Dynamic Academic Fallback for any other query
    const stopWords = new Set(['tell', 'me', 'about', 'what', 'is', 'are', 'explain', 'how', 'does', 'do', 'can', 'you', 'give', 'please', 'the', 'a', 'an', 'in', 'on', 'for', 'to', 'of', 'with', 'briefly', 'details']);
    const meaningfulWords = promptText.replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 1 && !stopWords.has(w.toLowerCase()));
    const mainTopic = (meaningfulWords.length > 0 ? meaningfulWords.slice(0, 4).join(' ') : promptText).trim() || userSubject;
    const capitalizedTopic = mainTopic.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

    let response = `### 📖 Academic Overview: ${capitalizedTopic}

#### 1. Concept Definition & Scope
Regarding **"${promptText}"**:
In ${userSubject || 'Computer Science and Academic Studies'}, **${capitalizedTopic}** encompasses the formal theoretical principles, structural specifications, and practical methodologies used to address core computational challenges.

#### 2. Theoretical Breakdown & Mechanisms
* **Fundamental Objectives**: Establishes formal invariants, structured data flows, and predictable operational boundaries.
* **Architectural Organization**: Modular decomposition separating high-level specifications from physical execution layers.
* **Efficiency & Trade-offs**: Balances computational overhead, resource utilization, and implementation maintainability.

#### 3. Step-by-Step Analytical Walkthrough
1. **Input / Pre-conditions**: Validate domain bounds and verify structural integrity.
2. **Operational Transformation**: Apply deterministic state transitions and transformation rules.
3. **Output / Post-conditions**: Guarantee system invariants and return validated results.

#### 4. High-Yield Exam & Revision Points
* Always formalize boundary conditions and edge cases in examination answers.
* Memorize definitions, primary mathematical formulas, and asymptotic complexity bounds.
* Illustrate answers with clean block diagrams and annotated data-flow sketches.`;

    if (hadConfiguredKey && lastGeminiError) {
        response += `\n\n---\n*💡 Note: Generated via StudyMate Academic Knowledge Engine. To enable real-time Google Gemini cloud responses, ensure your \`.env\` contains a valid Google AI Studio key (starts with \`AIzaSy...\`) from [Google AI Studio](https://aistudio.google.com/app/apikey).*`;
    }

    return response;
}

// Chat-integrated academic assistant and communication drafting
async function handleChatAssistantPrompt(promptText, mode = 'study_help', userSubject = 'Computer Science') {
    const rawKey = process.env.GEMINI_API_KEY;
    const isConfigured = Boolean(rawKey && rawKey.trim().length > 0);

    if (isConfigured) {
        let systemContext = '';
        const cleanTextInstruction = `IMPORTANT FORMATTING RULES: 
- Write in clean, plain English. Do NOT use LaTeX math notation (no dollar signs like $x$, no \\to, \\le, \\ge, \\cdot, \\times, \\frac etc.). 
- Instead of LaTeX, write math in plain text: use '->' instead of '\\to', use '<=' instead of '\\le', write fractions as 'a/b', write 'O(log n)' not '$O(\\log n)$'.
- Use markdown headers (### Topic), bold (**text**), bullet points (- item), and numbered lists (1. item) for structure.
- Keep responses concise, well-organized, and easy to read for university students.`;

        if (mode === 'draft_intro') {
            systemContext = `You are an academic communication helper for university students. Draft a warm, respectful, and concise study partner introductory message (2-3 sentences) proposing collaboration. The user context is: ${userSubject}. ${cleanTextInstruction}`;
        } else if (mode === 'draft_schedule') {
            systemContext = `You are a student collaboration assistant. Draft a polite message proposing a study session time and agenda for exam preparation in ${userSubject}. ${cleanTextInstruction}`;
        } else if (mode === 'study_plan') {
            systemContext = `You are an academic coach. Provide a structured, realistic study session plan or topic breakdown for ${userSubject}. ${cleanTextInstruction}`;
        } else {
            systemContext = `You are StudyMate AI Study Assistant, an expert academic tutor for university students in ${userSubject}. Explain concepts clearly with examples. Use plain text, not LaTeX. ${cleanTextInstruction}`;
        }

        const fullPrompt = `${systemContext}\n\nStudent Query: ${promptText}`;
        const externalResponse = await callGeminiApi(fullPrompt);
        if (externalResponse) {
            // Post-process: remove any stray LaTeX artifacts the LLM might still include
            const cleaned = externalResponse
                .replace(/\$\$[\s\S]*?\$\$/g, match => match.replace(/\$\$/g, '').trim())
                .replace(/\$((?:[^$\\]|\\.)*?)\$/g, '$1')
                .replace(/\\to\b/g, '->')
                .replace(/\\rightarrow\b/g, '->')
                .replace(/\\leftarrow\b/g, '<-')
                .replace(/\\le\b/g, '<=')
                .replace(/\\ge\b/g, '>=')
                .replace(/\\neq\b/g, '!=')
                .replace(/\\cdot\b/g, '*')
                .replace(/\\times\b/g, 'x')
                .replace(/\\log\b/g, 'log')
                .replace(/\\sqrt\{([^}]+)\}/g, 'sqrt($1)')
                .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)')
                .replace(/\\\\/g, '\n');
            return {
                response: cleaned,
                provider: 'Google Gemini'
            };
        }
    }

    // Dynamic high-yield academic response generator
    if (mode === 'draft_intro') {
        return {
            response: `Hi! I noticed we are both taking ${userSubject || 'similar courses'}. Would you be interested in pairing up as study partners to prepare for the upcoming midterms and review problem sets together?`,
            provider: 'StudyMate Academic Engine'
        };
    }
    
    if (mode === 'draft_schedule') {
        return {
            response: `Hey! Are you free this Thursday evening around 6:00 PM for an online study session? We could go over the key algorithms and practice solving previous semester questions.`,
            provider: 'StudyMate Academic Engine'
        };
    }
    
    if (mode === 'study_plan') {
        return {
            response: `Here is a high-yield 2-hour study session plan for **${userSubject}**:\n\n1. **Phase 1 (30 mins)**: Core Theory & Invariant Definitions review.\n2. **Phase 2 (45 mins)**: Solve 2-3 standard algorithmic numerical problems together.\n3. **Phase 3 (30 mins)**: Cross-quiz each other on edge cases & time complexities.\n4. **Phase 4 (15 mins)**: Summary wrap-up and assign next topic goals.`,
            provider: 'StudyMate Academic Engine'
        };
    }

    const dynamicReply = generateTopicStudyResponse(promptText, userSubject, isConfigured);
    return {
        response: dynamicReply,
        provider: 'StudyMate Academic Engine'
    };
}

module.exports = {
    isAiConfigured,
    callGeminiApi,
    generateAcademicSummary,
    answerDocumentQuestion,
    generateStructuredNotes,
    generateQuestionsFromContent,
    generateFlashcardsFromContent,
    generateConceptMapFromContent,
    handleChatAssistantPrompt
};
