export type StreamType = 'CSE' | 'EEE' | 'ECE' | 'ME' | 'CE' | 'CH';
export type ExamType = 'GATE' | 'UGC_NET' | 'CUSTOM';

export const SYLLABUS_DB: Record<ExamType, Partial<Record<StreamType, string[]>>> = {
  GATE: {
    CSE: [
      "Engineering Mathematics Discrete Mathematics",
      "Digital Logic Boolean Algebra",
      "Computer Organization and Architecture",
      "Programming and Data Structures in C",
      "Algorithms Analysis and Design",
      "Theory of Computation Automata",
      "Compiler Design Lexical Analysis",
      "Operating Systems Process Management",
      "Databases SQL and Normalization",
      "Computer Networks TCP/IP",
      "General Aptitude Verbal Ability",
      "General Aptitude Numerical Ability"
    ],
    EEE: [
      "Electric Circuits Network Analysis",
      "Electromagnetic Fields Maxwell Equations",
      "Signals and Systems Laplace Transform",
      "Electrical Machines Transformers and Induction Motors",
      "Power Systems Stability and Protection",
      "Control Systems Bode Plot and Routh-Hurwitz",
      "Electrical and Electronic Measurements",
      "Analog Electronics Op-Amps",
      "Digital Electronics Logic Gates",
      "Power Electronics Thyristors and Choppers",
      "Engineering Mathematics Calculus"
    ],
    ECE: [
      "Network Theory KCL KVL",
      "Signals and Systems FFT and Z-Transform",
      "Control Systems State Space Analysis",
      "Analog Circuits Diodes and BJT",
      "Digital Circuits Combinational Logic",
      "Electromagnetics Transmission Lines",
      "Electronic Devices MOSFET and CMOS",
      "Communications Analog and Digital Modulation",
      "Engineering Mathematics Linear Algebra"
    ],
    ME: [
      "Engineering Mechanics and Strength of Materials",
      "Theory of Machines and Vibrations",
      "Machine Design Gears and Bearings",
      "Fluid Mechanics and Hydraulic Machines",
      "Thermodynamics and Heat Transfer",
      "Manufacturing Engineering Casting and Welding",
      "Industrial Engineering PERT and CPM",
      "Engineering Mathematics Differential Equations",
      "General Aptitude Reasoning"
    ],
    CE: [
      "Structural Engineering Strength of Materials",
      "Geotechnical Engineering Soil Mechanics",
      "Water Resources Engineering Fluid Mechanics",
      "Environmental Engineering Waste Water",
      "Transportation Engineering Highway Design",
      "Geomatics Engineering Surveying",
      "Construction Materials and Management",
      "Engineering Mathematics Probability"
    ],
    CH: [
      "Process Calculations and Thermodynamics",
      "Fluid Mechanics and Mechanical Operations",
      "Heat Transfer Conductive and Convective",
      "Mass Transfer Distillation and Absorption",
      "Chemical Reaction Engineering Kinetics",
      "Instrumentation and Process Control",
      "Plant Design and Economics",
      "Chemical Technology Inorganic Chemicals"
    ]
  },
  UGC_NET: {
    CSE: [
      "Discrete Structures and Optimization",
      "Computer System Architecture",
      "Programming Languages and Computer Graphics",
      "Database Management Systems",
      "System Software and Operating System",
      "Software Engineering",
      "Data Structures and Algorithms",
      "Theory of Computation and Compilers",
      "Data Communication and Computer Networks",
      "Artificial Intelligence"
    ],
    EEE: [
      "Electronic Transport in Semiconductor",
      "Logic Families and Logic Gates",
      "Network Analysis and Synthesis",
      "Control System Analysis",
      "Analog and Digital Communication",
      "Microprocessor and Microcontroller",
      "Power Electronics and Drives",
      "Material Science for Electronics"
    ],
    ECE: [
      "Semiconductor Devices and ICs",
      "Network Theory and Circuit Analysis",
      "Analog and Digital Electronics",
      "Electromagnetics and Microwaves",
      "Communication Systems",
      "Signals and Systems",
      "Control Systems",
      "Fiber Optic Communication"
    ],
    // Mapping other streams to nearest relevant NET subject or Generic High-Level
    ME: [
        "Thermodynamics and Heat Transfer",
        "Fluid Mechanics",
        "Materials Science",
        "Manufacturing Processes",
        "Industrial Engineering",
        "Machine Design",
        "Applied Mechanics"
    ],
    CE: [
        "Structural Analysis",
        "Soil Mechanics",
        "Fluid Mechanics and Hydraulics",
        "Environmental Engineering",
        "Highway and Traffic Engineering",
        "Surveying and Geomatics"
    ],
    CH: [
        "Chemical Engineering Thermodynamics",
        "Reaction Engineering",
        "Mass and Heat Transfer",
        "Fluid Particle Mechanics",
        "Process Control",
        "Chemical Process Industries"
    ]
  },
  CUSTOM: {}
};

export const getExamTopics = (exam: ExamType, stream: StreamType): string[] => {
  if (exam === 'CUSTOM') return [];
  return SYLLABUS_DB[exam]?.[stream] || [];
};