const GhanaClass = require("../models/GhanaClass");

describe("School Setup Simple Tests", () => {
  test("Should get Ghanaian class levels", () => {
    const levels = GhanaClass.getGhanaianLevels();
    expect(Array.isArray(levels)).toBe(true);
    expect(levels.length).toBe(18);
    expect(levels[0].name).toBe("Creche");
    expect(levels[13].name).toBe("JHS 3");
    expect(levels[17].name).toBe("A-Level");
  });

  test("Should get next level for promotion", () => {
    const nextLevel = GhanaClass.getNextLevel("Primary 1");
    expect(nextLevel).toBe("Primary 2");
    
    const shsLevel = GhanaClass.getNextLevel("JHS 3");
    expect(shsLevel).toBe("SHS 1");

    const lastLevel = GhanaClass.getNextLevel("A-Level");
    expect(lastLevel).toBeNull();
  });

  test("Should get Ghanaian curriculum", () => {
    const curriculum = GhanaClass.getGhanaianLevels();
    expect(curriculum).toBeDefined();
    expect(Array.isArray(curriculum)).toBe(true);
  });
});
