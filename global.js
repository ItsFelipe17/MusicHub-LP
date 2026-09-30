
const logo = document.getElementsByClassName("botao-logo"); // pegando o elemento pelo ID

// estamos pegando o elemento de forma genérica - pode ser classe (precisa trazer o ponto) ou pode ser ID (precisa trazer o hashtag).
const navMenu = document.querySelector(".navegacao")

menu.addEventListener("click", function() {

    if(navMenu.className == "navegacao") {
        navMenu.className = "navegacao ativo";
    }
    else {
        navMenu.className = "navegacao";
    }
}) 

// Opção com arrow function -> função lambda
// menu.addEventListener ("click", () => {}) 

