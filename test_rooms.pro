room(kitchen).
room(office).
room(hall).
room('dining room').
room(cellar).

door(office, hall).
door(kitchen, office).
door(hall, 'dining room').
door(kitchen, cellar).
door('dining room', kitchen).

location(desk, office).
location(apple, kitchen).
location(flashlight, desk).
location('washing machine', cellar).
location(nani, 'washing machine').
location(broccoli, kitchen).
location(crackers, kitchen).
location(computer, office).

edible(apple).
edible(crackers).

tastes_yucky(broccoli).

here(kitchen).

member(M,[M|T]).
member(M,[H|T]) :- member(M,T).

where_food(X,Y) :-  
  location(X,Y),
 (edible(X);tastes_yucky(X)).
 
connect(X,Y) :- door(X,Y); door(Y,X).

list_things(Place) :-  
  location(X, Place),
  write(X),fail.
list_things(Other) :- unify(a,a).
path(Here, There, Path, _) :- path([There], Here, Path).
path([H|T], H, [H|T]).
 
path([H|T], Y, Path) :-
      connect(H,Next),
      not(member(Next,[H|T])),
      path([Next,H|T],Y, Path).
