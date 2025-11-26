import { 
    sec_const_number,
    random_string
 } from "./constance.js";


export function encrypt_text(text)
{
    const array_of_text = text.split("");
    const reverse_array_of_text = array_of_text.reverse();
    const en_text = reverse_array_of_text.join("");

    return en_text;
}



export function encrypt_number(number)
{
  const number_to_string = new String(parseInt(number)-sec_const_number);
  
  const encrypt_number_to_text = "THisis" + number_to_string  + "MyAge" + random_string;

  return encrypt_number_to_text;

}



