export const SKILLS_TAXONOMY = {
  "Technology": [
    "Software Engineering", "Frontend Development", "Backend Development",
    "Mobile Development", "DevOps", "Data Science", "Machine Learning",
    "Cybersecurity", "Blockchain", "Hardware Engineering", "Embedded Systems",
  ],
  "Medicine & Health": [
    "Medicine (General)", "Surgery", "Public Health",
    "Pharmacy", "Nursing", "Mental Health", "Biotech", "Medical Research",
  ],
  "Law & Policy": [
    "Constitutional Law", "International Law", "Human Rights",
    "Economic Policy", "Environmental Law", "Urban Planning Law", "Policy Writing",
  ],
  "Economics & Finance": [
    "Economics", "Finance", "Accounting", "Investment",
    "Banking", "Microfinance", "Startup Funding",
  ],
  "Engineering": [
    "Civil Engineering", "Mechanical Engineering",
    "Electrical Engineering", "Architecture", "Urban Planning",
    "Environmental Engineering", "Agricultural Engineering",
  ],
  "Education": [
    "Teaching", "Curriculum Design", "Educational Technology", "Pedagogy",
  ],
  "Social Sciences": [
    "Sociology", "Political Science", "Anthropology",
    "Psychology", "Communications",
  ],
  "Creative": [
    "Graphic Design", "UX/UI Design", "Video Production",
    "Photography", "Writing", "Translation (Farsi↔English)", "Journalism",
  ],
  "Business": [
    "Project Management", "Operations", "Marketing", "Sales",
    "HR", "Strategy",
  ],
  "Other": [
    "Community Organizing", "Event Management", "Data Analysis",
    "Research (General)",
  ],
} as const;

export type SkillCategory = keyof typeof SKILLS_TAXONOMY;
export type Skill = (typeof SKILLS_TAXONOMY)[SkillCategory][number];

export function getAllSkills(): string[] {
  return Object.values(SKILLS_TAXONOMY).flat();
}

export function getCategoryForSkill(skill: string): SkillCategory | null {
  for (const [category, skills] of Object.entries(SKILLS_TAXONOMY)) {
    if ((skills as readonly string[]).includes(skill)) {
      return category as SkillCategory;
    }
  }
  return null;
}
