import networkx as nx
import streamlit as st
import matplotlib.pyplot as plt

towns = [
    "Thiruvananthapuram", "Kollam", "Alappuzha", "Kottayam", "Pathanamthitta",
    "Idukki", "Ernakulam", "Thrissur", "Palakkad",
    "Malappuram", "Kozhikode", "Wayanad", "Kannur", "Kasaragod"
]

st.title("Shortest route between distances")

st.subheader("District #1")
district_1 = st.selectbox(options=towns, label="Choose District #1")

st.subheader("District #2")
district_2 = st.selectbox(options=towns, label="Choose District #2")


g=nx.Graph()

g.add_nodes_from(towns)

g.add_edge("Thiruvananthapuram", "Kollam", weight=65)
g.add_edge("Kollam", "Alappuzha", weight=85)
g.add_edge("Alappuzha", "Kottayam", weight=47)
g.add_edge("Kottayam", "Pathanamthitta", weight=65)
g.add_edge("Pathanamthitta", "Kollam", weight=70)
g.add_edge("Kottayam", "Idukki", weight=110)
g.add_edge("Idukki", "Ernakulam", weight=105)

g.add_edge("Alappuzha", "Ernakulam", weight=55)
g.add_edge("Ernakulam", "Thrissur", weight=80)
g.add_edge("Thrissur", "Palakkad", weight=67)
g.add_edge("Thrissur", "Malappuram", weight=110)
g.add_edge("Malappuram", "Kozhikode", weight=50)
g.add_edge("Kozhikode", "Wayanad", weight=85)
g.add_edge("Kozhikode", "Kannur", weight=90)
g.add_edge("Kannur", "Kasaragod", weight=90)
p = nx.spring_layout(g)

if st.button("Calculate distance") and (district_1 and district_2):
    path = nx.shortest_path(g, weight="weight", source=district_1, target=district_2)
    st.success(f"Distance between {district_1} and {district_2} is: {nx.shortest_path_length(g, weight="weight", source=district_1, target=district_2)}")
    st.success(f"Path: {" -> ".join(path)}")
    plt.figure(figsize=(7, 9))
    nx.draw(
        g, p, with_labels=True, node_size=2000,
        node_color="green", font_color="Black", edgecolors="black"
    )    
    st.pyplot(plt)
elif district_2 is None or district_1 is None:
    st.error("Complete the options!")