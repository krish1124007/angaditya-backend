import { 
    sec_const_number,
    random_string
 } from "./constance.js";



export function decrypt_number(encrypted_number)
{
    const plan_number = encrypted_number.replace("THisis","").replace("MyAge","").replace(random_string,"");

    const string_to_number = new Number(plan_number);

    return string_to_number + sec_const_number;
}

export function decrypt_text(encrypted_text)
{
    const plan_text = encrypted_text.split("").reverse().join("");

    return plan_text;
}