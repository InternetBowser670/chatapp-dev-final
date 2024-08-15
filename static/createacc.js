var form = document.getElementById("form");

form.addEventListener("submit", (e) => {
  e.preventDefault();

  var formData = new FormData(form);

  fetch("/signup", {
    method: "POST",
    body: formData
    // Do not set the Content-Type header manually; FormData will handle it
  })
  .then(response => response.json().then(result => ({ response, result })))
  .then(({ response, result }) => {
    if (response.ok) {
      alert(result.message);
      window.location.href = "./dashboard";
    } else {
      alert(`Error: ${result.message}`);
    }
  })
  .catch(error => {
    console.error("Error:", error);
    alert("An error occurred while creating the account.");
  });
});
