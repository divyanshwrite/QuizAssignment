import os
import re
import io
import logging
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse
import httpx
from typing import List, Optional
import json
from pydantic import BaseModel
import pdfplumber
from docx import Document
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

QUIZ_STORAGE_DIR = "generated_quizzes"
LEADERBOARD_FILE = "leaderboard.json"
os.makedirs(QUIZ_STORAGE_DIR, exist_ok=True)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", 
        "http://localhost:5174", 
        "http://localhost:5175", 
        "http://127.0.0.1:5173", 
        "http://127.0.0.1:5174", 
        "http://127.0.0.1:5175",
        "https://quiz-app-ten-phi-14.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class QuizQuestion(BaseModel):
    question: str
    options: List[str]
    answer: str
    type: str
    level: str
    topic: str
    drag_count: Optional[int] = None
    drop_count: Optional[int] = None
    drag_items: Optional[List[str]] = None
    drop_zones: Optional[List[str]] = None
    answer_mapping: Optional[dict] = None

class LeaderboardEntry(BaseModel):
    player_name: str
    score: int
    total_questions: int
    time_taken: int
    quiz_topic: str
    completion_date: str

# Load API key from environment variables
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

if not OPENROUTER_API_KEY:
    logger.error("OPENROUTER_API_KEY not found in environment variables")
    raise ValueError("OPENROUTER_API_KEY environment variable is required")

def save_quiz_to_file(questions: List[QuizQuestion], filename: str = None) -> str:
    try:
        if not filename:
            now = datetime.now()
            month = now.strftime("%m")
            day = now.strftime("%d")
            filename = f"quiz_{month}_{day}.json"
        
        filepath = os.path.join(QUIZ_STORAGE_DIR, filename)
        
        quiz_data = {
            "generated_at": datetime.now().isoformat(),
            "total_questions": len(questions),
            "questions": [
                {
                    "question": q.question,
                    "options": q.options,
                    "answer": q.answer,
                    "type": q.type,
                    "level": q.level,
                    "topic": q.topic
                }
                for q in questions
            ]
        }
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(quiz_data, f, indent=2, ensure_ascii=False)
        
        logger.info(f"Quiz saved to: {filepath}")
        return filepath
        
    except Exception as e:
        logger.error(f"Error saving quiz to file: {e}")
        return None

def convert_quiz_to_markdown(questions: List[QuizQuestion]) -> str:
    markdown_content = []
    
    if questions:
        topics = list(set([q.topic for q in questions]))
        if len(topics) == 1:
            title = f"# {topics[0]} Quiz"
        else:
            title = f"# Multi-Topic Quiz ({', '.join(topics)})"
    else:
        title = "# Quiz"
    
    markdown_content.append(title)
    markdown_content.append("")
    markdown_content.append(f"**Generated:** {datetime.now().strftime('%B %d, %Y at %I:%M %p')}")
    markdown_content.append(f"**Total Questions:** {len(questions)}")
    markdown_content.append("")
    
    topics = {}
    for i, question in enumerate(questions):
        topic = question.topic
        if topic not in topics:
            topics[topic] = []
        topics[topic].append((i + 1, question))
    
    for topic, topic_questions in topics.items():
        markdown_content.append(f"## {topic}")
        markdown_content.append("")
        
        for question_num, question in topic_questions:
            markdown_content.append(f"### Question {question_num}")
            markdown_content.append(f"**Level:** {question.level} | **Type:** {question.type.replace('-', ' ').title()}")
            markdown_content.append("")
            
            markdown_content.append(f"**Q:** {question.question}")
            markdown_content.append("")
            
            if question.type == "multiple-choice":
                for i, option in enumerate(question.options):
                    letter = chr(65 + i)
                    is_correct = option == question.answer
                    marker = "[CORRECT]" if is_correct else "[OPTION]"
                    markdown_content.append(f"{marker} **{letter}.** {option}")
            elif question.type == "true-false":
                for option in question.options:
                    is_correct = option == question.answer
                    marker = "[CORRECT]" if is_correct else "[OPTION]"
                    markdown_content.append(f"{marker} **{option}**")
            elif question.type == "matching":
                markdown_content.append("**Match the items:**")
                for i, option in enumerate(question.options):
                    if "|" in option:
                        item, desc = option.split("|", 1)
                        markdown_content.append(f"{i+1}. {item} -> {desc}")
                    else:
                        markdown_content.append(f"{i+1}. {option}")
                markdown_content.append(f"**Correct Matches:** {question.answer}")
            
            markdown_content.append("")
            markdown_content.append(f"**Correct Answer:** {question.answer}")
            markdown_content.append("")
            markdown_content.append("---")
            markdown_content.append("")
    
    markdown_content.append("## Answer Key")
    markdown_content.append("")
    for i, question in enumerate(questions):
        markdown_content.append(f"{i + 1}. {question.answer} ({question.level} - {question.topic})")
    
    return "\n".join(markdown_content)

def save_leaderboard_entry(entry: LeaderboardEntry) -> bool:
    try:
        leaderboard_path = os.path.join(QUIZ_STORAGE_DIR, LEADERBOARD_FILE)
        
        leaderboard = []
        if os.path.exists(leaderboard_path):
            with open(leaderboard_path, 'r', encoding='utf-8') as f:
                leaderboard = json.load(f)
        
        leaderboard.append({
            "player_name": entry.player_name,
            "score": entry.score,
            "total_questions": entry.total_questions,
            "percentage": round((entry.score / entry.total_questions) * 100, 1),
            "time_taken": entry.time_taken,
            "quiz_topic": entry.quiz_topic,
            "completion_date": entry.completion_date
        })
        
        leaderboard.sort(key=lambda x: (-x["percentage"], x["time_taken"]))
        
        leaderboard = leaderboard[:100]
        
        with open(leaderboard_path, 'w', encoding='utf-8') as f:
            json.dump(leaderboard, f, indent=2, ensure_ascii=False)
        
        return True
        
    except Exception as e:
        logger.error(f"Error saving leaderboard entry: {e}")
        return False

def get_leaderboard() -> List[dict]:

    try:
        leaderboard_path = os.path.join(QUIZ_STORAGE_DIR, LEADERBOARD_FILE)
        
        if not os.path.exists(leaderboard_path):
            return []
        
        with open(leaderboard_path, 'r', encoding='utf-8') as f:
            return json.load(f)
            
    except Exception as e:
        logger.error(f"Error loading leaderboard: {e}")
        return []

def extract_text_from_pdf(file_content: bytes) -> str:

    try:
        with pdfplumber.open(io.BytesIO(file_content)) as pdf:
            text = ""
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
        return text.strip()
    except Exception as e:
        logger.error(f"Error extracting text from PDF: {e}")
        raise HTTPException(status_code=400, detail="Error processing PDF file")

def extract_text_from_docx(file_content: bytes) -> str:

    try:
        doc = Document(io.BytesIO(file_content))
        text = ""
        for paragraph in doc.paragraphs:
            text += paragraph.text + "\n"
        return text.strip()
    except Exception as e:
        logger.error(f"Error extracting text from DOCX: {e}")
        raise HTTPException(status_code=400, detail="Error processing DOCX file")

async def generate_quiz_with_ai(text: str) -> List[QuizQuestion]:

    try:
        headers = {
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "Content-Type": "application/json"
        }
        
        if len(text) > 8000:
            text = text[:8000] + "..."
        
        prompt = f"""Create EXACTLY 6 quiz questions STRICTLY from this document content: {text}

CRITICAL REQUIREMENTS:
- ALL questions MUST be based on information EXPLICITLY found in the provided text
- DO NOT create generic questions
- DO NOT use outside knowledge
- ONLY use facts, names, dates, concepts directly mentioned in the document
- STOP after 6 questions

ANSWER FORMAT RULES:
1. For multiple-choice: "answer" must be the EXACT FULL TEXT of the correct option
2. For true-false: "answer" must be exactly "True" or "False"  
3. For matching: Include BOTH items to match AND their matches in the options array. Format: ["Item1","Item2","Match1","Match2"] and answer: "Item1-Match1,Item2-Match2"

MATCHING QUESTION REQUIREMENTS:
- Options array MUST contain ALL items: both things to match AND their corresponding matches
- Do NOT put matches in the answer that aren't in the options array
- Example: If matching people with roles, options should be ["Person1","Person2","Role1","Role2"] not just ["Person1","Person2"]

EXAMPLES (using document content):
{{"question":"What specific company/organization is mentioned in the document?","options":["[Company from doc]","[Wrong option]","[Wrong option]","[Wrong option]"],"answer":"[Company from doc]","type":"multiple-choice","level":"Beginner","topic":"Organizations"}}

{{"question":"According to the document, [specific fact from text]","options":["True","False"],"answer":"True","type":"true-false","level":"Intermediate","topic":"Facts"}}

{{"question":"Match the person with their role","options":["Dr. John Smith","Mary Johnson","CEO","CTO"],"answer":"Dr. John Smith-CEO,Mary Johnson-CTO","type":"matching","level":"Intermediate","topic":"Personnel"}}

Output: Array of exactly 6 questions (2 multiple-choice, 2 true-false, 2 matching) based ONLY on the provided document content."""
        
        payload = {
            "model": "anthropic/claude-3.5-haiku:beta",
            "messages": [
                {
                    "role": "system",
                    "content": "You are a JSON generator. Output only valid JSON arrays. Never explain, never comment, never add text. Only JSON."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "max_tokens": 1200,
            "temperature": 0.1
        }
        
        logger.info("Sending request to OpenRouter API...")
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers=headers,
                json=payload
            )
            
            logger.info(f"OpenRouter API response status: {response.status_code}")
            
            if response.status_code != 200:
                error_text = response.text
                logger.error(f"OpenRouter API error ({response.status_code}): {error_text}")
                
                if response.status_code == 429:
                    # Extract reset time from error response if available
                    try:
                        error_data = response.json()
                        reset_timestamp = error_data.get("error", {}).get("metadata", {}).get("headers", {}).get("X-RateLimit-Reset")
                        if reset_timestamp:
                            reset_time = datetime.fromtimestamp(int(reset_timestamp) / 1000)
                            reset_str = reset_time.strftime("%B %d, %Y at %I:%M %p")
                            detail_msg = f"Daily rate limit exceeded for free tier. Resets on {reset_str}. Consider upgrading to paid tier for more requests."
                        else:
                            detail_msg = "Rate limit exceeded. Please wait before generating another quiz."
                    except:
                        detail_msg = "Rate limit exceeded. Please wait before generating another quiz."
                    
                    raise HTTPException(status_code=429, detail=detail_msg)
                else:
                    raise HTTPException(status_code=500, detail=f"AI service error: {error_text}")
            
            response_data = response.json()
            
            if "choices" not in response_data or not response_data["choices"]:
                raise HTTPException(status_code=500, detail="Invalid response from AI service")
            
            content = response_data["choices"][0]["message"]["content"]
            logger.info(f"AI response content (full): {content}")
            logger.info(f"AI response content length: {len(content)}")
            
            if not content or content.strip() == "":
                logger.error("AI returned empty content")
                raise HTTPException(status_code=500, detail="AI model returned empty response. Please try again.")
            
            
            try:
                if "```json" in content:
                    start_marker = "```json"
                    end_marker = "```"
                    start_idx = content.find(start_marker) + len(start_marker)
                    end_idx = content.find(end_marker, start_idx)
                    if end_idx != -1:
                        json_str = content[start_idx:end_idx].strip()
                    else:
                        json_str = content[start_idx:].strip()
                else:
                    json_str = content.strip()
                
                import re
                
                def parse_multiple_json_objects(text):
                    """Parse multiple JSON objects and return them as a list"""
                    objects = []
                    
                    try:
                        if text.strip().startswith('[') and text.strip().endswith(']'):
                            return json.loads(text)
                    except:
                        pass
                    
                    lines = text.split('\n')
                    current_object = ""
                    brace_count = 0
                    
                    for line in lines:
                        line = line.strip()
                        if not line:
                            continue
                            
                        current_object += line
                        
                        brace_count += line.count('{') - line.count('}')
                        
                        if brace_count == 0 and current_object.strip():
                            try:
                                obj = json.loads(current_object)
                                if isinstance(obj, dict):
                                    objects.append(obj)
                                elif isinstance(obj, list):
                                    objects.extend(obj)
                            except json.JSONDecodeError:
                                fixed_object = current_object
                                fixed_object = re.sub(r',(\s*[}\]])', r'\1', fixed_object)
                                try:
                                    obj = json.loads(fixed_object)
                                    if isinstance(obj, dict):
                                        objects.append(obj)
                                    elif isinstance(obj, list):
                                        objects.extend(obj)
                                except:
                                    logger.warning(f"Could not parse JSON object: {current_object}")
                            
                            current_object = ""
                    
                    if current_object.strip() and brace_count == 0:
                        try:
                            obj = json.loads(current_object)
                            if isinstance(obj, dict):
                                objects.append(obj)
                            elif isinstance(obj, list):
                                objects.extend(obj)
                        except:
                            logger.warning(f"Could not parse final JSON object: {current_object}")
                    
                    return objects
                
                try:
                    questions_data = parse_multiple_json_objects(json_str)
                except Exception as e:
                    logger.warning(f"Multiple JSON parsing failed: {e}, attempting single parse...")
                    try:
                        start_idx = json_str.find('[')
                        end_idx = json_str.rfind(']') + 1
                        if start_idx != -1 and end_idx != 0:
                            json_str = json_str[start_idx:end_idx]
                        
                        questions_data = json.loads(json_str)
                    except json.JSONDecodeError:
                        logger.warning("Initial JSON parse failed, attempting cleanup...")
                        json_str = re.sub(r',\s*\}', '}', json_str)  # Remove trailing commas
                        json_str = re.sub(r',\s*\]', ']', json_str)  # Remove trailing commas in arrays
                        
                        if '{' in json_str:
                            start = json_str.find('{')
                            brace_count = 0
                            end = start
                            
                            for i, char in enumerate(json_str[start:], start):
                                if char == '{':
                                    brace_count += 1
                                elif char == '}':
                                    brace_count -= 1
                                    if brace_count == 0:
                                        end = i + 1
                                        break
                            
                            if end > start:
                                single_object = json_str[start:end]
                                try:
                                    obj = json.loads(single_object)
                                    questions_data = [obj] if isinstance(obj, dict) else obj
                                except:
                                    logger.error("All JSON parsing attempts failed")
                                    questions_data = []
                            else:
                                questions_data = []
                        else:
                            questions_data = []
                
                if not isinstance(questions_data, list):
                    if isinstance(questions_data, dict):
                        questions_data = [questions_data]
                    else:
                        raise ValueError("Response is not a valid format")
                
                valid_questions = []
                for q_data in questions_data:
                    if (isinstance(q_data, dict) and 
                        "question" in q_data and 
                        "options" in q_data and 
                        "answer" in q_data):
                        
                        if q_data.get("type") == "matching" and isinstance(q_data["options"], str):
                            options_str = q_data["options"]
                            q_data["options"] = [opt.strip() for opt in options_str.split(",")]
                            logger.info(f"Fixed matching question options: {q_data['options']}")
                        
                        if q_data.get("type") == "matching":
                            if len(q_data["options"]) < 4:
                                logger.warning(f"Skipping matching question with insufficient options: {q_data}")
                                continue
                            
                            cleaned_options = []
                            drag_items = []
                            drop_zones = []
                            
                            for opt in q_data["options"]:
                                if isinstance(opt, str):
                                    if opt.startswith("DRAG:"):
                                        item = opt[5:].strip()  # Remove "DRAG:" prefix
                                        drag_items.append(item)
                                        cleaned_options.append(item)
                                    elif opt.startswith("DROP:"):
                                        item = opt[5:].strip()  # Remove "DROP:" prefix
                                        drop_zones.append(item)
                                        cleaned_options.append(item)
                                    elif '-' in opt and opt[0].isdigit():
                                        cleaned_options.append(opt.split('-', 1)[1].strip())
                                    else:
                                        cleaned_options.append(opt)
                            
                            if not drag_items and not drop_zones and q_data["answer"]:
                                answer_str = q_data["answer"]
                                unique_drag_items = []
                                unique_drop_zones = []
                                answer_parts = []  # Initialize here to avoid scope issues
                                
                                import re
                                matches = re.findall(r'([^,-]+)-([^,]*(?:,[^-]*)*?)(?=,\s*[^,-]+-|$)', answer_str)
                                
                                if not matches:
                                    answer_parts = answer_str.split(',')
                                    for part in answer_parts:
                                        if '-' in part:
                                            parts = part.split('-', 1)  # Split only on first dash
                                            drag_item = parts[0].strip()
                                            drop_zone = parts[1].strip()
                                            
                                            if drag_item in cleaned_options and drag_item not in unique_drag_items:
                                                unique_drag_items.append(drag_item)
                                            if drop_zone in cleaned_options and drop_zone not in unique_drop_zones:
                                                unique_drop_zones.append(drop_zone)
                                else:
                                    answer_parts = [f"{drag}-{drop}" for drag, drop in matches]
                                    for drag_item, drop_zone in matches:
                                        drag_item = drag_item.strip()
                                        drop_zone = drop_zone.strip()
                                        
                                        if drag_item in cleaned_options and drag_item not in unique_drag_items:
                                            unique_drag_items.append(drag_item)
                                        if drop_zone in cleaned_options and drop_zone not in unique_drop_zones:
                                            unique_drop_zones.append(drop_zone)
                                
                                if unique_drag_items and unique_drop_zones:
                                    drag_items = unique_drag_items
                                    drop_zones = unique_drop_zones
                                else:
                                    mid = len(cleaned_options) // 2
                                    drag_items = cleaned_options[:mid]
                                    drop_zones = cleaned_options[mid:]
                                
                                logger.info(f"Auto-detected matching format - drag_items: {drag_items}, drop_zones: {drop_zones}")
                                logger.info(f"Answer parts analyzed: {answer_parts}")
                                logger.info(f"Original cleaned_options: {cleaned_options}")
                            
                            if drag_items and drop_zones:
                                q_data["options"] = cleaned_options
                                
                                answer_mapping = {}
                                if q_data["answer"]:
                                    answer_parts = q_data["answer"].split(',')
                                    for part in answer_parts:
                                        if '-' in part:
                                            parts = part.split('-', 1)
                                            drag_item = parts[0].strip()
                                            drop_zone = parts[1].strip()
                                            if drag_item in drag_items and drop_zone in drop_zones:
                                                answer_mapping[drag_item] = drop_zone
                                
                                q_data["drag_count"] = len(drag_items)
                                q_data["drop_count"] = len(drop_zones)
                                q_data["drag_items"] = drag_items
                                q_data["drop_zones"] = drop_zones
                                q_data["answer_mapping"] = answer_mapping
                                
                                logger.info(f"=== MATCHING QUESTION DEBUG ===")
                                logger.info(f"Drag items: {drag_items}")
                                logger.info(f"Drop zones: {drop_zones}")
                                logger.info(f"Answer mapping: {answer_mapping}")
                                logger.info(f"Original options: {q_data['options']}")
                                logger.info(f"=== END DEBUG ===")
                            else:
                                mid = len(cleaned_options) // 2
                                drag_items = cleaned_options[:mid]
                                drop_zones = cleaned_options[mid:]
                                
                                q_data["options"] = cleaned_options
                                
                                answer_mapping = {}
                                for i, drag_item in enumerate(drag_items):
                                    if i < len(drop_zones):
                                        answer_mapping[drag_item] = drop_zones[i]
                                
                                q_data["drag_count"] = len(drag_items)
                                q_data["drop_count"] = len(drop_zones)
                                q_data["drag_items"] = drag_items
                                q_data["drop_zones"] = drop_zones
                                q_data["answer_mapping"] = answer_mapping
                                
                                logger.info(f"=== FALLBACK MATCHING QUESTION DEBUG ===")
                                logger.info(f"Fallback drag items: {drag_items}")
                                logger.info(f"Fallback drop zones: {drop_zones}")
                                logger.info(f"Fallback answer mapping: {answer_mapping}")
                                logger.info(f"=== END FALLBACK DEBUG ===")
                            
                            if q_data["answer"] and ',' in q_data["answer"]:
                                answer_parts = q_data["answer"].split(',')
                                fixed_answers = []
                                
                                for part in answer_parts:
                                    part = part.strip()
                                    if not part:
                                        continue
                                        
                                    parts = [p.strip() for p in part.split('-') if p.strip()]
                                    if len(parts) >= 3:
                                        name = parts[0]
                                        role = parts[-1]
                                        fixed_answers.append(f"{name}-{role}")
                                    elif len(parts) == 2:
                                        fixed_answers.append(part)
                                
                                if drag_items and len(drag_items) == len(fixed_answers):
                                    final_answers = []
                                    for i in range(len(drag_items)):
                                        name = drag_items[i]
                                        role = fixed_answers[i].split('-')[-1].strip()
                                        final_answers.append(f"{name}-{role}")
                                    
                                    q_data["answer"] = ','.join(final_answers)
                                    logger.info(f"Fixed matching answer format: {q_data['answer']}")
                                    
                                    if 'answer_mapping' in q_data:
                                        new_mapping = {}
                                        for drag_item in drag_items:
                                            if drag_item in q_data['answer_mapping']:
                                                role = q_data['answer_mapping'][drag_item].split('-')[-1].strip()
                                                new_mapping[drag_item] = f"{drag_item}-{role}"
                                        q_data['answer_mapping'] = new_mapping
                                elif len(cleaned_options) >= 4 and len(fixed_answers) >= 2:
                                    mid = len(cleaned_options) // 2
                                    items = cleaned_options[:mid]
                                    
                                    if len(items) == len(fixed_answers):
                                        q_data["answer"] = ','.join([f"{items[i]}-{fixed_answers[i]}" for i in range(len(items))])
                                        logger.info(f"Fixed matching answer format: {q_data['answer']}")
                        
                        if not isinstance(q_data["options"], list):
                            logger.warning(f"Skipping question with invalid options format: {q_data}")
                            continue
                        
                        if "type" not in q_data:
                            q_data["type"] = "multiple-choice"
                        if "level" not in q_data:
                            q_data["level"] = "Beginner"
                        if "topic" not in q_data:
                            q_data["topic"] = "General Knowledge"
                        
                        if q_data["type"] == "multiple-choice":
                            answer = q_data["answer"]
                            if len(answer) == 1 and answer.upper() in ['A', 'B', 'C', 'D']:
                                option_index = ord(answer.upper()) - ord('A')
                                if 0 <= option_index < len(q_data["options"]):
                                    q_data["answer"] = q_data["options"][option_index]
                                    logger.info(f"Fixed answer format: {answer} -> {q_data['answer']}")
                        
                        if q_data["type"] in ["multiple-choice", "true-false"]:
                            if q_data["answer"] not in q_data["options"]:
                                logger.warning(f"Skipping question with answer not in options: {q_data}")
                                continue
                            
                        valid_questions.append(q_data)
                
                questions_data = valid_questions
                
                if len(questions_data) > 6:
                    questions_data = questions_data[:6]
                    logger.info(f"Trimmed response to 6 questions")
                
                if len(questions_data) == 0:
                    raise ValueError("No valid questions found in AI response")
                if len(questions_data) > 6:
                    questions_data = questions_data[:6]
                    logger.info(f"Trimmed response to 6 questions (was {len(questions_data)} questions)")
                
                
                if len(questions_data) == 0:
                    raise ValueError("No valid questions found in AI response")
                
                
                questions = []
                for q_data in questions_data:
                    question = QuizQuestion(
                        question=q_data["question"],
                        options=q_data["options"],
                        answer=q_data["answer"],
                        type=q_data.get("type", "multiple-choice"),
                        level=q_data.get("level", "Beginner"),
                        topic=q_data.get("topic", "General Knowledge"),
                        drag_count=q_data.get("drag_count"),
                        drop_count=q_data.get("drop_count"),
                        drag_items=q_data.get("drag_items"),
                        drop_zones=q_data.get("drop_zones"),
                        answer_mapping=q_data.get("answer_mapping")
                    )
                    questions.append(question)
                
                return questions
                
            except (json.JSONDecodeError, ValueError) as e:
                logger.error(f"Failed to parse AI response as JSON: {e}")
                logger.error(f"AI response content: {content}")
                raise HTTPException(status_code=500, detail=f"Failed to parse AI response. The AI model may have generated malformed content. Please try again in a minute.")
    
    except httpx.TimeoutException:
        logger.error("Request to AI service timed out")
        raise HTTPException(status_code=504, detail="AI service request timed out")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating quiz: {e}")
        raise HTTPException(status_code=500, detail=f"Error generating quiz: {str(e)}")

@app.post("/api/generate-quiz", response_model=List[QuizQuestion])
async def generate_quiz(
    file: Optional[UploadFile] = File(None),
    text: Optional[str] = Form(None)
):

    try:
        logger.info(f"Received request to /api/generate-quiz")
        
        document_text = ""
        
        if file:
            logger.info(f"Processing file: {file.filename}, Content-Type: {file.content_type}")
            
            
            if not file.content_type:
                raise HTTPException(status_code=400, detail="Unable to determine file type")
            
            
            file_content = await file.read()
            
            
            if len(file_content) > 10 * 1024 * 1024:
                raise HTTPException(status_code=400, detail="File size exceeds 10MB limit")
            
            
            if file.content_type == "application/pdf":
                document_text = extract_text_from_pdf(file_content)
            elif file.content_type in ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/msword"]:
                document_text = extract_text_from_docx(file_content)
            else:
                raise HTTPException(status_code=400, detail="Unsupported file type. Please upload PDF or DOCX files.")
        
        elif text:
            document_text = text.strip()
        
        else:
            raise HTTPException(status_code=400, detail="Please provide either a file or text input")
        
        if not document_text:
            raise HTTPException(status_code=400, detail="No text content found in the provided input")
        
        if len(document_text) < 100:
            raise HTTPException(status_code=400, detail="Document content is too short to generate meaningful questions")
        
        logger.info(f"Extracted {len(document_text)} characters from file")
        logger.info(f"Document preview: {document_text[:200]}...")
        
        
        questions = await generate_quiz_with_ai(document_text)
        
        if not questions:
            raise HTTPException(status_code=500, detail="Failed to generate quiz questions")
        
        logger.info(f"Successfully generated {len(questions)} questions")
        
        
        saved_filepath = save_quiz_to_file(questions)
        if saved_filepath:
            logger.info(f"Quiz saved to local file: {saved_filepath}")
        else:
            logger.warning("Failed to save quiz to local file")
        
        return questions
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error(f"Global exception handler: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {str(exc)}"}
    )

@app.get("/")
async def root():
    return {"message": "Regulatory Quiz Generator API is running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "message": "API is operational"}

@app.get("/api/rate-limit-status")
async def get_rate_limit_status():
    return {
        "model": "anthropic/claude-3.5-haiku:beta",
        "limit": "Free tier with Claude Haiku model",
        "message": "Using Anthropic Claude 3.5 Haiku model for quiz generation.",
        "reset_info": "Rate limit resets according to OpenRouter free tier policy.",
        "upgrade_tip": "Consider upgrading to paid tier for unlimited requests",
        "current_status": "Ready to generate quizzes"
    }

@app.get("/api/saved-quizzes")
async def get_saved_quizzes():

    try:
        quiz_files = []
        if os.path.exists(QUIZ_STORAGE_DIR):
            for filename in os.listdir(QUIZ_STORAGE_DIR):
                if filename.endswith('.json') and filename != LEADERBOARD_FILE:
                    filepath = os.path.join(QUIZ_STORAGE_DIR, filename)
                    try:
                        with open(filepath, 'r', encoding='utf-8') as f:
                            quiz_data = json.load(f)
                        
                        
                        if isinstance(quiz_data, dict) and "questions" in quiz_data:
                            quiz_files.append({
                                "filename": filename,
                                "generated_at": quiz_data.get("generated_at"),
                                "total_questions": quiz_data.get("total_questions", 0),
                                "topics": list(set([q.get("topic", "Unknown") for q in quiz_data.get("questions", [])]))
                            })
                    except Exception as e:
                        logger.error(f"Error reading quiz file {filename}: {e}")
        
        
        quiz_files.sort(key=lambda x: x.get("generated_at", ""), reverse=True)
        
        return {"saved_quizzes": quiz_files, "total_count": len(quiz_files)}
    
    except Exception as e:
        logger.error(f"Error retrieving saved quizzes: {e}")
        raise HTTPException(status_code=500, detail="Error retrieving saved quizzes")

@app.get("/api/quiz/{filename}")
async def get_quiz_by_filename(filename: str):

    try:
        filepath = os.path.join(QUIZ_STORAGE_DIR, filename)
        
        if not os.path.exists(filepath):
            raise HTTPException(status_code=404, detail="Quiz file not found")
        
        with open(filepath, 'r', encoding='utf-8') as f:
            quiz_data = json.load(f)
        
        return quiz_data
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving quiz {filename}: {e}")
        raise HTTPException(status_code=500, detail="Error retrieving quiz")

@app.get("/api/quiz/{filename}/markdown", response_class=PlainTextResponse)
async def export_quiz_as_markdown(filename: str):

    try:
        filepath = os.path.join(QUIZ_STORAGE_DIR, filename)
        
        if not os.path.exists(filepath):
            raise HTTPException(status_code=404, detail="Quiz file not found")
        
        with open(filepath, 'r', encoding='utf-8') as f:
            quiz_data = json.load(f)
        
        
        questions = []
        for q_data in quiz_data.get("questions", []):
            question = QuizQuestion(
                question=q_data["question"],
                options=q_data["options"],
                answer=q_data["answer"],
                type=q_data.get("type", "multiple-choice"),
                level=q_data.get("level", "Beginner"),
                topic=q_data.get("topic", "General Knowledge")
            )
            questions.append(question)
        
        
        markdown_content = convert_quiz_to_markdown(questions)
        
        return markdown_content
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error exporting quiz {filename} as markdown: {e}")
        raise HTTPException(status_code=500, detail="Error exporting quiz as markdown")

@app.post("/api/generate-quiz/markdown", response_class=PlainTextResponse)
async def generate_quiz_markdown(
    file: Optional[UploadFile] = File(None),
    text: Optional[str] = Form(None)
):

    try:
        
        logger.info(f"Received request to /api/generate-quiz/markdown")
        
        document_text = ""
        
        if file:
            logger.info(f"Processing file: {file.filename}, Content-Type: {file.content_type}")
            
            
            if not file.content_type:
                raise HTTPException(status_code=400, detail="Unable to determine file type")
            
            
            file_content = await file.read()
            
            
            if len(file_content) > 10 * 1024 * 1024:
                raise HTTPException(status_code=400, detail="File size exceeds 10MB limit")
            
            
            if file.content_type == "application/pdf":
                document_text = extract_text_from_pdf(file_content)
            elif file.content_type in ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/msword"]:
                document_text = extract_text_from_docx(file_content)
            else:
                raise HTTPException(status_code=400, detail="Unsupported file type. Please upload PDF or DOCX files.")
        
        elif text:
            document_text = text.strip()
        
        else:
            raise HTTPException(status_code=400, detail="Please provide either a file or text input")
        
        if not document_text:
            raise HTTPException(status_code=400, detail="No text content found in the provided input")
        
        if len(document_text) < 100:
            raise HTTPException(status_code=400, detail="Document content is too short to generate meaningful questions")
        
        
        questions = await generate_quiz_with_ai(document_text)
        
        if not questions:
            raise HTTPException(status_code=500, detail="Failed to generate quiz questions")
        
        logger.info(f"Successfully generated {len(questions)} questions for markdown export")
        
        
        markdown_content = convert_quiz_to_markdown(questions)
        
        return markdown_content
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in markdown generation: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.post("/api/leaderboard")
async def submit_score(entry: LeaderboardEntry):

    try:
        success = save_leaderboard_entry(entry)
        if success:
            return {"message": "Score submitted successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to save score")
    except Exception as e:
        logger.error(f"Error submitting score: {e}")
        raise HTTPException(status_code=500, detail="Error submitting score")

@app.get("/api/leaderboard")
async def get_leaderboard_data():

    try:
        leaderboard = get_leaderboard()
        return {"leaderboard": leaderboard, "total_entries": len(leaderboard)}
    except Exception as e:
        logger.error(f"Error retrieving leaderboard: {e}")
        raise HTTPException(status_code=500, detail="Error retrieving leaderboard")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
