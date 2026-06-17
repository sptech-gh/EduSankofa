import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";

import apiService from "../services/api"

const ExamPage = () => {
  const { id: examId } = useParams();
  const [exam, setExam] = useState(null);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(null);

  useEffect(() => {
    const fetchExam = async () => {
      try {
        const data = await apiService.get(`/api/exams/${examId}`);
        setExam(data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchExam();
  }, [examId]);

  const handleChange = (questionId, answer) => {
    setAnswers({ ...answers, [questionId]: answer });
  };

  const handleSubmit = async () => {
    try {
      const answerArray = Object.keys(answers).map((key) => ({
        questionId: key,
        answer: answers[key],
      }));
      const data = await apiService.`/api/exams/${examId}/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          answers: answerArray,
        }),
      });

      setScore(data && data.score);
      setSubmitted(true);
    } catch (err) {
      console.error(err);
    }
  };

  if (!exam) return <div>Loading exam...</div>;

  if (submitted)
    return (
      <div>
        <h2>Exam Results</h2>
        <p>
          You scored {score} out of {exam.questions.length}
        </p>
      </div>
    );

  return (
    <div>
      <h2>{exam.title}</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
      >
        {exam.questions.map((question) => (
          <div key={question._id}>
            <p>{question.questionText}</p>
            {question.options.map((option, idx) => (
              <label key={idx}>
                <input
                  type="radio"
                  name={question._id}
                  value={option}
                  checked={answers[question._id] === option}
                  onChange={() => handleChange(question._id, option)}
                  required
                />
                {option}
              </label>
            ))}
          </div>
        ))}
        <button type="submit">Submit Exam</button>
      </form>
    </div>
  );
};

export default ExamPage;
