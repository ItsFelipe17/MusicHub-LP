
const logo = document.getElementsByClassName("botao-logo"); // pegando o elemento pelo ID

// estamos pegando o elemento de forma genérica - pode ser classe (precisa trazer o ponto) ou pode ser ID (precisa trazer o hashtag).
const menuLateral = document.querySelector(".menu-lateral-perfil")

logo.addEventListener("click", function() {

    if(menuLateral.className == "menu-lateral-perfil") {
        menuLateral.className = "menu-lateral-perfil ativo";
    }
    else {
        menuLateral.className = "menu-lateral-perfil";
    }
}) 

// Opção com arrow function -> função lambda
// menu.addEventListener ("click", () => {}) 

