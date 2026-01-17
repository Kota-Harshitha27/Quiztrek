const chapter1=document.getElementById("chapter1");
chapter1.addEventListener("click",()=>
{
    localStorage.setItem('quiz_js_file', "class_wise_quiz/class_6_chapter_1.js");

    window.location.href = "../quiz-page/quizpage.html";
});
