// const {
//     GoogleGenerativeAI,
//     HarmCategory,
//     HarmBlockThreshold,
// } = require("@google/generative-ai");
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from '@google/generative-ai';
const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

export const jobPostingModel = genAI.getGenerativeModel({
  model: "gemini-2.0-flash-exp",
  // systemInstruction: "You are an AI job posting assistant. Your task is to analyze job descriptions and generate structured job posting data. Always return data in the following JSON format with all fields:\n\n{\n  \"designation\": \"\", // Job title (required)\n  \"companyName\": \"\", // Company name (required)\n  \"country\": \"\", // Country name as string\n  \"city\": \"\", // City name as string\n  \"experience\": [0, 0], // Array with min and max years\n  \"jobType\": \"\", // Full-Time, Part-Time, Contract, Freelance\n  \"position\": \"\", // Entry-Level, Mid-Level, Senior-Level, Lead, Manager\n  \"jobFeseability\": \"\", // Remote, On-Site, Hybrid\n  \"featuredBenefits\": \"\", // Comma-separated benefits\n  \"qualifications\": \"\", // Required qualifications\n  \"noOfPositions\": \"\", // Number of openings as string\n  \"gender\": \"\", // Male, Female, Any\n  \"payRange\": [\"0\", \"0\"], // Array with min and max salary as strings\n  \"payRangeStart\": \"\", // Min salary as string\n  \"payRangeEnd\": \"\", // Max salary as string\n  \"hashTags\": \"\", // Comma-separated hashtags with #\n  \"salaryCurrency\": \"\", // Currency code (e.g., USD, PKR)\n  \"desc\": \"\", // Detailed job description\n  \"skills\": \"\", // Comma-separated required skills\n  \"category\": \"\", // Job category name\n  \"applyEmail\": \"\", // Contact email\n  \"applyPhone\": \"\" // Contact phone\n}\n\nRules:\n- Never omit any fields\n- Use empty string \"\" for missing text fields\n- Use [0, 0] for missing number ranges\n- Use reasonable defaults based on industry standards\n- Ensure salary values are strings\n- Keep arrays for experience and payRange\n- Add relevant hashtags based on job details\n- Format benefits and skills as comma-separated lists",
  systemInstruction: `You are an AI job posting assistant. Your task is to analyze job descriptions and generate structured job posting data. Always return data in the following JSON format with all fields:

{
  "designation": "", // Job title (required)
  "companyName": "", // Company name (required)
  "country": "", // Country name as string , generate only proper Complete  Country name - look for location information and if not find look for city name and set country Name
  "city": "", // generate only proper City name as string, City name - extract from address or location details
  "experience": [0, 0], // Array with min and max years
  "jobType": "", // Full-Time, Part-Time, Contract, Freelance
  "position": "", // 'One of: Internship', 'Fresher', 'Associate', 'Mid-Level', 'Senior-Level',
  "jobFeseability": "", // One of: On-Site, Remote, Hybrid. If not mentioned default to On-Site
  "featuredBenefits": "", // Comma-separated benefits
  "qualifications": "", // Required qualifications One of: "Matriculation", "Intermediate", "Bachelor's Degree", "Master's Degree", "Doctorate/PhD", "Diploma/Certificate", "Professional Certification", "Technical Diploma", "Associate Degree", "Post Graduate Diploma", "M.Phil", "Other"
  "noOfPositions": "", // Number of openings as string
  "gender": "", // OneOf: Male, Female otherWise empty string 
  "payRange": ["0", "0"], // Array with min and max salary as strings
  "payRangeStart": "", // Min salary as string
  "payRangeEnd": "", // Max salary as string
  "hashTags": "", // Comma-separated Generate required hashtags with # and ,
  "salaryCurrency": "", // Currency code (e.g., USD, PKR)
  "desc": "", // Detailed job description add email or number if available on job desc and Format the "desc" field with line breaks (\n) and bold text using HTML tags (<b>...</b>) and list items using HTML tags (<li>...</li>) to show it properly in React-Quill
  "skills": "", // Comma-separated required skills
  "category": "", // Job category name
  "applyEmail": "", // Contact email
  "applyPhone": "" // Contact phone
}

Rules:
- Never omit any fields
- Use empty string "" for missing text fields
- Use [0, 0] for missing number ranges
- Use reasonable defaults based on industry standards
- Ensure salary values are strings
- Keep arrays for experience and payRange
- Add relevant hashtags based on job details
- Format benefits and skills as comma-separated lists
- If jobFeseability is not mentioned, default to "On-Site

`

});

// const generationConfig = {
//     temperature: 1,
//     topP: 0.95,
//     topK: 40,
//     maxOutputTokens: 8192,
//     responseMimeType: "text/plain",
// };

export const generationConfig = {
  temperature: 0.7, // Reduced for more concise responses
  topP: 0.8, // Slightly reduced for more focused output
  topK: 30, // Reduced for more focused output
  responseMimeType: "text/plain",
};



// Initialize the model
export const jobImageModel = genAI.getGenerativeModel({
  model: 'gemini-2.0-flash-exp',
  systemInstruction: `You are an AI job posting image analyzer. Your task is to analyze images of job postings/descriptions and extract structured data. Look for text, logos, and visual elements in the image to gather job-related information. Always return data in the following JSON format with all fields:

{
  "designation": "", // Job title (required) - extract from prominent text or headers
  "companyName": "", // generate only proper Company name (required) - look for company logo or letterhead
  "country": "", // Country name - look for location information and if not find look for city name and set country Name
  "city": "", // City name - extract from address or location details
  "experience": [0, 0], // Array with min and max years - look for experience requirements
  "jobType": "", // Full-Time, Part-Time, Contract, Freelance
  "position": "", // 'One of: Internship', 'Fresher', 'Associate', 'Mid-Level', 'Senior-Level'
  "jobFeseability": "", // One of: On-Site, Remote, Hybrid. Default to On-Site if not found
  "featuredBenefits": "", // Comma-separated benefits found in the image
  "qualifications": "", // One of: "Matriculation", "Intermediate", "Bachelor's Degree", "Master's Degree", "Doctorate/PhD", "Diploma/Certificate", "Professional Certification", "Technical Diploma", "Associate Degree", "Post Graduate Diploma", "M.Phil", "Other"
  "noOfPositions": "", // Number of openings
  "gender": "", // OneOf: Male, Female, otherwise empty string
  "payRange": ["0", "0"], // Array with min and max salary
  "payRangeStart": "", // Min salary as string
  "payRangeEnd": "", // Max salary as string
  "hashTags": "", // Generate relevant hashtags based on job details with # and ,
  "salaryCurrency": "", // Currency code (e.g., USD, PKR)
  "desc": "", // Extract full job description add email or number if available on job desc and Format the "desc" field with line breaks (\n) and bold text using HTML tags (<b>...</b>) and list items using HTML tags (<li>...</li>) to show it properly in React-Quill
  "skills": "", // Extract and list required skills, comma-separated
  "category": "", // Determine job category from context
  "applyEmail": "", // Look for contact email in image
  "applyPhone": "" // Look for contact phone in image
}

Rules:
- Scan the entire image for text and visual information
- Use OCR to extract text from all parts of the image
- Look for company logos and branding elements
- Pay attention to formatting and highlighted text
- Extract contact information carefully
- If information is not visible in the image, use empty string or [0, 0]
- Format description with proper HTML tags for React-Quill
- Generate relevant hashtags based on visible job details
- Default to "On-Site" for jobFeseability if not specified
`

});


// async function run() {
//     const chatSession = model.startChat({
//         generationConfig,
//     });


//     const instr = `Job Description to analyze:
//                 ${jobDescription}
//                     Generate the job posting data structure.`
//     const result = await chatSession.sendMessage();
//     console.log(result.response.text());
// }

// run();