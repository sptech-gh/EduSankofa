const GhanaClass = require("../models/GhanaClass");
const GhanaSubject = require("../models/GhanaSubject");

describe("School Setup Unit Tests", () => {
  describe("GhanaClass Model", () => {
    test("Should get Ghanaian class levels", () => {
      const levels = GhanaClass.getGhanaianLevels();
      expect(Array.isArray(levels)).toBe(true);
      expect(levels.length).toBe(14);
      
      // Check specific levels
      const creche = levels.find(l => l.name === "Creche");
      const jhs3 = levels.find(l => l.name === "JHS 3");
      
      expect(creche).toBeDefined();
      expect(creche.ageRange).toBe("3-4");
      expect(creche.order).toBe(1);
      
      expect(jhs3).toBeDefined();
      expect(jhs3.ageRange).toBe("16-17");
      expect(jhs3.order).toBe(14);
    });

    test("Should get next level for promotion", () => {
      const nextLevel1 = GhanaClass.getNextLevel("Primary 1");
      expect(nextLevel1).toBe("Primary 2");
      
      const nextLevel2 = GhanaClass.getNextLevel("JHS 2");
      expect(nextLevel2).toBe("JHS 3");
      
      const lastLevel = GhanaClass.getNextLevel("JHS 3");
      expect(lastLevel).toBeNull();
      
      const invalidLevel = GhanaClass.getNextLevel("Invalid Level");
      expect(invalidLevel).toBeNull();
    });
  });

  describe("GhanaSubject Model", () => {
    test("Should get Ghanaian curriculum structure", () => {
      const curriculum = GhanaSubject.getGhanaianCurriculum();
      expect(curriculum).toBeDefined();
      
      // Check that all levels exist
      expect(curriculum["Creche"]).toBeDefined();
      expect(curriculum["Nursery 1"]).toBeDefined();
      expect(curriculum["Primary 1"]).toBeDefined();
      expect(curriculum["JHS 3"]).toBeDefined();
      
      // Check specific subjects
      expect(curriculum["Primary 1"]).toContain("English Language");
      expect(curriculum["Primary 1"]).toContain("Mathematics");
      expect(curriculum["Primary 1"]).toContain("Integrated Science");
      
      expect(curriculum["JHS 3"]).toContain("English Language");
      expect(curriculum["JHS 3"]).toContain("Mathematics");
      expect(curriculum["JHS 3"]).toContain("Integrated Science");
      expect(curriculum["JHS 3"]).toContain("Career Technology");
    });

    test("Should get subjects by level", () => {
      const primary1Subjects = GhanaSubject.getSubjectsByLevel("Primary 1");
      expect(Array.isArray(primary1Subjects)).toBe(true);
      expect(primary1Subjects.length).toBeGreaterThan(0);
      expect(primary1Subjects).toContain("English Language");
      expect(primary1Subjects).toContain("Mathematics");
      
      const invalidSubjects = GhanaSubject.getSubjectsByLevel("Invalid Level");
      expect(invalidSubjects).toEqual([]);
    });
  });

  describe("Ghanaian Education Structure Validation", () => {
    test("Should have correct class progression", () => {
      const levels = GhanaClass.getGhanaianLevels();
      const levelNames = levels.map(l => l.name);
      
      // Check progression order
      const expectedProgression = [
        "Creche", "Nursery 1", "Nursery 2", "KG 1", "KG 2",
        "Primary 1", "Primary 2", "Primary 3", "Primary 4", "Primary 5", "Primary 6",
        "JHS 1", "JHS 2", "JHS 3"
      ];
      
      expect(levelNames).toEqual(expectedProgression);
    });

    test("Should have appropriate age ranges", () => {
      const levels = GhanaClass.getGhanaianLevels();
      
      // Check age range progression
      expect(levels[0].ageRange).toBe("3-4"); // Creche
      expect(levels[5].ageRange).toBe("8-9"); // Primary 1
      expect(levels[10].ageRange).toBe("13-14"); // Primary 6
      expect(levels[13].ageRange).toBe("16-17"); // JHS 3
    });

    test("Should have comprehensive subject coverage", () => {
      const curriculum = GhanaSubject.getGhanaianCurriculum();
      
      // Core subjects should be present at appropriate levels
      expect(curriculum["Primary 1"]).toContain("English Language");
      expect(curriculum["Primary 1"]).toContain("Mathematics");
      expect(curriculum["Primary 1"]).toContain("Integrated Science");
      expect(curriculum["Primary 1"]).toContain("Social Studies");
      
      // JHS should have additional subjects
      expect(curriculum["JHS 1"]).toContain("French");
      expect(curriculum["JHS 1"]).toContain("Basic Design & Technology");
      expect(curriculum["JHS 3"]).toContain("Career Technology");
      
      // Early years should have age-appropriate subjects
      expect(curriculum["Creche"]).toContain("Language Development");
      expect(curriculum["Creche"]).toContain("Number Work");
      expect(curriculum["Creche"]).toContain("Physical Development");
    });
  });
});
